import { supabase } from "./client";
import { camelizeRecord, snakeizeRecord, toSnakeCase } from "./transformers";
import { formatDateKey } from "../utils/format";

function applyFilters(queryBuilder, options = {}) {
  let builder = queryBuilder;

  if (options.where) {
    for (const clause of options.where) {
      const field = toSnakeCase(clause.field);
      switch (clause.operator) {
        case "==":
          builder = builder.eq(field, clause.value);
          break;
        case "!=":
          builder = builder.neq(field, clause.value);
          break;
        case ">":
          builder = builder.gt(field, clause.value);
          break;
        case ">=":
          builder = builder.gte(field, clause.value);
          break;
        case "<":
          builder = builder.lt(field, clause.value);
          break;
        case "<=":
          builder = builder.lte(field, clause.value);
          break;
        case "in":
          builder = builder.in(field, clause.value);
          break;
        default:
          builder = builder.eq(field, clause.value);
          break;
      }
    }
  }

  if (options.orderBy) {
    builder = builder.order(toSnakeCase(options.orderBy.field), {
      ascending: options.orderBy.direction !== "desc",
    });
  }

  return builder;
}

async function run(builder) {
  const { data, error } = await builder;
  if (error) {
    throw new Error(error.message);
  }
  return camelizeRecord(data ?? []);
}

export async function fetchCollection(collectionName, options = {}) {
  const builder = applyFilters(supabase.from(collectionName).select("*"), options);
  return run(builder);
}

export async function fetchSingle(collectionName, id) {
  const { data, error } = await supabase.from(collectionName).select("*").eq("id", id).single();
  if (error) {
    throw new Error(error.message);
  }
  return camelizeRecord(data);
}

export async function createOrUpdateUserProfile(uid, data) {
  const { uid: _, ...rest } = data;
  const payload = snakeizeRecord({
    ...rest,
    id: uid,
  });
  const { error } = await supabase.from("users").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}

export async function addRecord(collectionName, payload) {
  const { data, error } = await supabase.from(collectionName).insert(snakeizeRecord(payload)).select().single();
  if (error) {
    throw new Error(error.message);
  }
  return camelizeRecord(data);
}

export async function updateRecord(collectionName, id, payload) {
  const { error } = await supabase.from(collectionName).update(snakeizeRecord(payload)).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRecord(collectionName, id) {
  const { error } = await supabase.from(collectionName).delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

async function upsertBillLedgerEntry(tableName, billNo, amount, currentUser) {
  const { data: existing, error: existingError } = await supabase
    .from(tableName)
    .select("*")
    .eq("category", "bill_payment")
    .eq("note", `Bill ${billNo}`);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const current = existing?.[0];

  if (amount > 0) {
    if (current) {
      const { error } = await supabase
        .from(tableName)
        .update({ amount })
        .eq("id", current.id);
      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase.from(tableName).insert({
        type: "income",
        category: "bill_payment",
        amount,
        note: `Bill ${billNo}`,
        created_by: currentUser.uid,
        created_by_name: currentUser.name,
      });
      if (error) {
        throw new Error(error.message);
      }
    }
  } else if (current) {
    const { error } = await supabase.from(tableName).delete().eq("id", current.id);
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function createBill({ customer, items, summary, payment, currentUser }) {
  const { data, error } = await supabase.rpc("create_bill", {
    p_customer_id: customer.id || null,
    p_customer_name: customer.name,
    p_customer_phone: customer.phone,
    p_customer_address: customer.address || "",
    p_items: snakeizeRecord(items),
    p_subtotal: Number(summary.subtotal),
    p_discount: Number(summary.discount),
    p_total: Number(summary.total),
    p_cash_amount: Number(payment.cashAmount || 0),
    p_account_amount: Number(payment.accountAmount || 0),
    p_payment_type: payment.paymentType,
    p_created_by: currentUser.uid,
    p_created_by_name: currentUser.name,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function normalizeBillItems(items = []) {
  return items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    return {
      inventoryId: item.inventoryId || item.inventory_id,
      itemName: item.itemName || item.item_name || "",
      category: item.category || "",
      imei: item.imei || "",
      quantity,
      price,
      total: Number(item.total || quantity * price),
    };
  });
}

function aggregateBillQuantities(items) {
  return items.reduce((totals, item) => {
    if (!item.inventoryId) {
      return totals;
    }
    totals[item.inventoryId] = (totals[item.inventoryId] || 0) + Number(item.quantity || 0);
    return totals;
  }, {});
}

export async function updateBillAdmin(id, payload, currentUser) {
  const { data: existingBill, error: billError } = await supabase.from("bills").select("*").eq("id", id).single();
  if (billError) {
    throw new Error(billError.message);
  }

  const previousItems = normalizeBillItems(existingBill.items || []);
  const nextItems = normalizeBillItems(payload.items || previousItems);
  const previousQuantities = aggregateBillQuantities(previousItems);
  const nextQuantities = aggregateBillQuantities(nextItems);
  const inventoryIds = Array.from(new Set([...Object.keys(previousQuantities), ...Object.keys(nextQuantities)]));
  const nextSubtotal = nextItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const nextTotal = nextSubtotal - Number(payload.discount || 0);
  const cashAmount = Number(payload.cashAmount || 0);
  const accountAmount = Number(payload.accountAmount || 0);

  if (Math.abs(cashAmount + accountAmount - nextTotal) > 0.01) {
    throw new Error("Cash and account amounts must match the recalculated total.");
  }

  if (!nextItems.length) {
    throw new Error("Bill must have at least one item.");
  }

  if (inventoryIds.length) {
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("*")
      .in("id", inventoryIds);
    if (inventoryError) {
      throw new Error(inventoryError.message);
    }

    const inventoryMap = camelizeRecord(inventoryRows).reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});

    for (const inventoryId of inventoryIds) {
      const inventoryItem = inventoryMap[inventoryId];
      if (!inventoryItem) {
        throw new Error("Inventory item not found while updating bill.");
      }

      const previousQuantity = Number(previousQuantities[inventoryId] || 0);
      const nextQuantity = Number(nextQuantities[inventoryId] || 0);
      const availableAfterRestore = Number(inventoryItem.quantity || 0) + previousQuantity;

      if (availableAfterRestore < nextQuantity) {
        throw new Error(`Insufficient stock for ${inventoryItem.itemName}. Available ${availableAfterRestore}.`);
      }

      const updatedQuantity = availableAfterRestore - nextQuantity;
      const status =
        updatedQuantity <= 0 && inventoryItem.category !== "accessory"
          ? "sold"
          : inventoryItem.status === "sold"
            ? "available"
            : inventoryItem.status;

      const { error: stockUpdateError } = await supabase
        .from("inventory")
        .update({
          quantity: updatedQuantity,
          status,
        })
        .eq("id", inventoryId);

      if (stockUpdateError) {
        throw new Error(stockUpdateError.message);
      }

      const quantityDifference = nextQuantity - previousQuantity;
      if (quantityDifference !== 0) {
        await addRecord("inventory_transactions", {
          itemId: inventoryId,
          action: quantityDifference > 0 ? "sold" : "returned",
          quantity: Math.abs(quantityDifference),
          note: `Bill ${existingBill.bill_no} edited`,
          staffId: currentUser.uid,
        });
      }
    }
  }

  const { error: updateError } = await supabase
    .from("bills")
    .update({
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      items: snakeizeRecord(nextItems),
      subtotal: nextSubtotal,
      discount: Number(payload.discount || 0),
      total: nextTotal,
      cash_amount: cashAmount,
      account_amount: accountAmount,
      payment_type: payload.paymentType,
    })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await upsertBillLedgerEntry("cash_ledger", existingBill.bill_no, cashAmount, currentUser);
  await upsertBillLedgerEntry("account_ledger", existingBill.bill_no, accountAmount, currentUser);
}

export async function createServiceJob(payload, currentUser) {
  const { data: id, error } = await supabase.rpc("create_service_job", {
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone,
    p_brand: payload.brand,
    p_model: payload.model,
    p_imei: payload.imei || "",
    p_problem: payload.problem,
    p_estimate: Number(payload.estimate || 0),
    p_advance: Number(payload.advance || 0),
    p_status: payload.status || "received",
    p_received_by: currentUser.uid,
    p_received_by_name: currentUser.name,
    p_box_no: payload.boxNo || ""
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!id) {
    throw new Error("Service job could not be created.");
  }

  if (payload.receivedAt) {
    await updateRecord("service_jobs", id, { receivedAt: payload.receivedAt });
  }

  return fetchSingle("service_jobs", id);
}

export async function updateServiceStatus(id, status) {
  const patch = {
    status,
    deliveredAt: status === "delivered" ? new Date().toISOString() : null,
  };
  await updateRecord("service_jobs", id, patch);
}

export async function checkInStaff() {
  const { error } = await supabase.rpc("check_in_staff");
  if (error) {
    console.error("Attendance check-in failed:", error.message);
  }
}

export async function upsertStaffAttendance({ staffId, staffName, attendanceDate, status, salaryAmount = 0, paidAmount = 0, note = "" }) {
  const dateValue = attendanceDate || null;
  if (!staffName || !dateValue) {
    throw new Error("Staff name and attendance date are required.");
  }

  let query = supabase.from("staff_attendance").select("*").eq("attendance_date", dateValue);
  
  if (staffId) {
    query = query.eq("staff_id", staffId);
  } else {
    query = query.eq("staff_name", staffName);
  }

  const { data: existingRows, error: existingError } = await query.limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existing = existingRows?.[0];
  const payload = {
    staff_id: staffId || null,
    staff_name: staffName,
    attendance_date: dateValue,
    status: status || "present",
    salary_amount: Number(salaryAmount || 0),
    paid_amount: Number(paidAmount || 0),
    note: note || "",
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("staff_attendance")
      .update(payload)
      .eq("id", existing.id);
    
    if (updateError) throw new Error(updateError.message);
    return fetchSingle("staff_attendance", existing.id);
  }

  const { data, error: insertError } = await supabase
    .from("staff_attendance")
    .insert([payload])
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  return data;
}

export async function addInventoryItem(payload, currentUser) {
  const itemPayload = snakeizeRecord({
    ...payload,
    quantity: Number(payload.quantity),
    buyingPrice: Number(payload.buyingPrice),
    sellingPrice: Number(payload.sellingPrice),
    minStock: Number(payload.minStock || 0),
    createdBy: currentUser.uid,
    createdByName: currentUser.name,
  });

  const { data, error } = await supabase.from("inventory").insert(itemPayload).select().single();
  if (error) {
    throw new Error(error.message);
  }

  const item = camelizeRecord(data);
  await addRecord("inventory_transactions", {
    itemId: item.id,
    action: "stock_in",
    quantity: Number(payload.quantity),
    note: payload.note || "Initial stock entry",
    staffId: currentUser.uid,
  });
}

export async function updateInventoryItem(id, payload) {
  await updateRecord("inventory", id, {
    ...payload,
    quantity: Number(payload.quantity),
    buyingPrice: Number(payload.buyingPrice),
    sellingPrice: Number(payload.sellingPrice),
    minStock: Number(payload.minStock || 0),
  });
}

export async function addLedgerEntry(ledgerName, payload, currentUser) {
  await addRecord(ledgerName === "cash" ? "cash_ledger" : "account_ledger", {
    ...payload,
    amount: Number(payload.amount),
    createdBy: currentUser.uid,
    createdByName: currentUser.name,
  });
}

export async function createOldMobilePurchase(payload, currentUser) {
  const { error } = await supabase.rpc("create_old_mobile_purchase", {
    p_customer_name: payload.customerName,
    p_brand: payload.brand,
    p_model: payload.model,
    p_imei: payload.imei,
    p_serial_number: payload.serialNumber || "",
    p_buy_price: Number(payload.buyPrice),
    p_expected_sell_price: Number(payload.expectedSellPrice || 0),
    p_condition: payload.condition || "",
    p_note: payload.note || "",
    p_created_by: currentUser.uid,
    p_created_by_name: currentUser.name,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPurchaseEntry(payload, currentUser) {
  // Ensure supplier is in customers (parties) table
  await supabase.rpc('ensure_customer', { 
    p_name: payload.supplierName, 
    p_phone: payload.supplierPhone 
  });

  const purchaseNo = payload.purchaseNo || `PUR-${formatDateKey(new Date())}-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
  const totalAmount = Number(payload.quantity || 0) * Number(payload.buyingPrice || 0);

  const purchase = await addRecord("purchase_entries", {
    purchaseNo,
    supplierName: payload.supplierName,
    supplierPhone: payload.supplierPhone || "",
    category: payload.category,
    type: payload.type || "",
    brand: payload.brand || "",
    model: payload.model || "",
    itemName: payload.itemName,
    quantity: Number(payload.quantity || 0),
    buyingPrice: Number(payload.buyingPrice || 0),
    sellingPrice: Number(payload.sellingPrice || 0),
    totalAmount,
    paymentSource: payload.paymentSource || "cash",
    note: payload.note || "",
    createdBy: currentUser.uid,
    createdByName: currentUser.name,
  });

  const inventoryPayload = snakeizeRecord({
    category: payload.category,
    type: payload.type || "stock_item",
    brand: payload.brand || "",
    model: payload.model || "",
    itemName: payload.itemName,
    serialNumber: payload.serialNumber || "",
    buyingPrice: Number(payload.buyingPrice || 0),
    sellingPrice: Number(payload.sellingPrice || 0),
    quantity: Number(payload.quantity || 0),
    minStock: Number(payload.minStock || 0),
    supplier: payload.supplierName || "",
    status: "available",
    note: payload.note || "",
    createdBy: currentUser.uid,
    createdByName: currentUser.name,
  });

  const { data: inventoryData, error: inventoryError } = await supabase.from("inventory").insert(inventoryPayload).select().single();
  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const inventoryItem = camelizeRecord(inventoryData);
  await addRecord("inventory_transactions", {
    itemId: inventoryItem.id,
    action: "stock_in",
    quantity: Number(payload.quantity || 0),
    note: `Purchase ${purchaseNo}`,
    staffId: currentUser.uid,
  });

  await addLedgerEntry(payload.paymentSource === "account" ? "account" : "cash", {
    type: "expense",
    category: "stock_purchase",
    amount: totalAmount,
    note: `Purchase ${purchaseNo} - ${payload.itemName}`,
  }, currentUser);

  return purchase;
}

export async function updatePurchaseEntry(id, payload) {
  const totalAmount = Number(payload.quantity || 0) * Number(payload.buyingPrice || 0);
  await updateRecord("purchase_entries", id, {
    supplierName: payload.supplierName,
    supplierPhone: payload.supplierPhone || "",
    category: payload.category,
    type: payload.type || "",
    brand: payload.brand || "",
    model: payload.model || "",
    itemName: payload.itemName,
    paymentSource: payload.paymentSource || "cash",
    note: payload.note || "",
    quantity: Number(payload.quantity || 0),
    buyingPrice: Number(payload.buyingPrice || 0),
    sellingPrice: Number(payload.sellingPrice || 0),
    totalAmount,
  });
}

export async function sellOldMobile({ inventoryId, sellPrice, customerName, currentUser }) {
  const { error } = await supabase.rpc("sell_old_mobile", {
    p_inventory_id: inventoryId,
    p_sell_price: Number(sellPrice),
    p_customer_name: customerName,
    p_created_by: currentUser.uid,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function adjustLedgerBalance(ledgerName, targetAmount, currentUser) {
  const tableName = ledgerName === "cash" ? "cash_ledger" : "account_ledger";
  const { data, error } = await supabase.from(tableName).select("type, amount");
  if (error) {
    throw new Error(error.message);
  }

  const currentBalance = camelizeRecord(data).reduce((sum, entry) => sum + (entry.type === "income" ? Number(entry.amount || 0) : -Number(entry.amount || 0)), 0);
  const target = Number(targetAmount || 0);
  const difference = target - currentBalance;

  if (difference === 0) {
    return;
  }

  await addLedgerEntry(ledgerName, {
    type: difference > 0 ? "income" : "expense",
    category: "balance_adjustment",
    amount: Math.abs(difference),
    note: `Admin balance adjustment to ${target}`,
  }, currentUser);
}

export async function transferBetweenLedgers({ from, to, amount, note }, currentUser) {
  const transferAmount = Number(amount || 0);
  if (!transferAmount || from === to) {
    throw new Error("Choose different source and destination with a valid amount.");
  }

  await addLedgerEntry(from, {
    type: "expense",
    category: "shop_balance_transfer",
    amount: transferAmount,
    note: note || `Transfer to ${to}`,
  }, currentUser);

  await addLedgerEntry(to, {
    type: "income",
    category: "shop_balance_transfer",
    amount: transferAmount,
    note: note || `Transfer from ${from}`,
  }, currentUser);
}

async function saveCustomerFromTransfer(payload) {
  const phone = String(payload.customerPhone || "").trim();
  if (!phone) {
    return;
  }

  const customerPayload = {
    name: payload.customerName || "Customer",
    phone,
    aadharNo: payload.aadharNo || "",
  };

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const existingCustomer = data?.[0];
  if (existingCustomer) {
    const { error: updateError } = await supabase
      .from("customers")
      .update(snakeizeRecord(customerPayload))
      .eq("id", existingCustomer.id);
    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  const { error: insertError } = await supabase.from("customers").insert(snakeizeRecord(customerPayload));
  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function createMoneyTransfer(payload, currentUser) {
  const transferAmount = Number(payload.transferAmount || 0);
  const commission = Number(payload.commission || 0);
  if (!transferAmount) {
    throw new Error("Enter a valid transfer amount.");
  }

  await saveCustomerFromTransfer(payload);

  const transferNo = `MT-${formatDateKey(new Date())}-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
  const isCashToBank = payload.transferType === "cash_to_bank";
  const receivedSource = isCashToBank ? "cash" : "account";
  const payoutSource = isCashToBank ? "account" : "cash";
  const totalReceived = transferAmount + commission;

  const transfer = await addRecord("money_transfers", {
    transferNo,
    customerName: payload.customerName || "",
    customerPhone: payload.customerPhone || "",
    aadharNo: payload.aadharNo || "",
    transferType: payload.transferType,
    transferAmount,
    commission,
    totalReceived,
    receivedSource,
    payoutSource,
    note: payload.note || "",
    createdBy: currentUser.uid,
    createdByName: currentUser.name,
  });

  await addLedgerEntry(receivedSource, {
    type: "income",
    category: "money_transfer_received",
    amount: totalReceived,
    note: `${transferNo} received from ${payload.customerName || "customer"}`,
  }, currentUser);

  await addLedgerEntry(payoutSource, {
    type: "expense",
    category: "money_transfer_paid",
    amount: transferAmount,
    note: `${transferNo} paid to ${payload.customerName || "customer"}`,
  }, currentUser);

  return transfer;
}

export async function ensureUserProfile(authUser) {
  const existing = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (!existing.data) {
    const bootstrapProfile = {
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Staff",
      phone: authUser.user_metadata?.phone || "",
      role: "staff",
      active: true,
    };
    const { error } = await supabase.from("users").insert(snakeizeRecord(bootstrapProfile));
    if (error) {
      throw new Error(error.message);
    }
    return bootstrapProfile;
  }

  return camelizeRecord(existing.data);
}
