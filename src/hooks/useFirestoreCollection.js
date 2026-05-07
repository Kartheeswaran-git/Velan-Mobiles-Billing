import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import { fetchCollection } from "../supabase/database";

export function useFirestoreCollection(collectionName, options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const records = await fetchCollection(collectionName, options);
        if (!active) return;
        setData(records);
        setError("");
      } catch (collectionError) {
        if (!active) return;
        setError(collectionError.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    const channel = supabase
      .channel(`realtime:${collectionName}:${JSON.stringify(options)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: collectionName,
        },
        () => {
          load();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setError(`Realtime subscription failed for ${collectionName}`);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [collectionName, JSON.stringify(options)]);

  return { data, loading, error };
}
