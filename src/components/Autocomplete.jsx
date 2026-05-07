import { useEffect, useRef, useState } from "react";

export default function Autocomplete({ 
  value, 
  onChange, 
  onSelect, 
  suggestions, 
  placeholder, 
  required,
  label,
  hint
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const filteredSuggestions = suggestions.filter((s) => 
    String(s || "").toLowerCase().includes(String(value || "").toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
      setIsOpen(true);
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && highlightedIndex !== -1) {
      e.preventDefault();
      onSelect(filteredSuggestions[highlightedIndex]);
      setIsOpen(false);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <div className="autocomplete-header">
        {label && <label className="autocomplete-label">{label}</label>}
        {hint && <span className="autocomplete-hint">{hint}</span>}
      </div>
      <div className="autocomplete-input-wrapper">
        <input
          type="text"
          className="autocomplete-input"
          value={value}
          onChange={(e) => {
            onChange(e);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
        {isOpen && value.length >= 2 && filteredSuggestions.length > 0 && (
          <ul className="autocomplete-dropdown">
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                className={`autocomplete-item ${index === highlightedIndex ? "highlighted" : ""}`}
                onClick={() => {
                  onSelect(suggestion);
                  setIsOpen(false);
                }}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
