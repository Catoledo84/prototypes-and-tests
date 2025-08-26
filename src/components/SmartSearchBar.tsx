import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/tokens.css';

type FieldType = 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'relation';

type OptionSource = string[] | ((query: string) => Promise<string[]>);

export type FieldSchema = {
  label: string;
  type: FieldType;
  options?: OptionSource;
};

export type Schema = Record<string, FieldSchema>;

export type AstNode =
  | { kind: 'condition'; field: string; op: string; value: string }
  | { kind: 'group'; op: 'and' | 'or'; children: AstNode[] };

export type SmartSearchBarProps = {
  schema: Schema;
  onChange?: (ast: AstNode | null, text: string) => void;
  placeholder?: string;
};

const STRING_OPS = ['contains', '=', '!='];
const NUMBER_OPS = ['=', '!=', '>', '>=', '<', '<='];
const DATE_OPS = NUMBER_OPS;
const ENUM_OPS = ['=', '!='];
const BOOL_OPS = ['=', '!='];

function getOps(type: FieldType): string[] {
  switch (type) {
    case 'string':
      return STRING_OPS;
    case 'number':
      return NUMBER_OPS;
    case 'date':
      return DATE_OPS;
    case 'enum':
    case 'relation':
      return ENUM_OPS;
    case 'boolean':
      return BOOL_OPS;
  }
}

function isAsyncOptions(src?: OptionSource): src is (q: string) => Promise<string[]> {
  return typeof src === 'function';
}

function useOptions(src: OptionSource | undefined, query: string) {
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!src) {
        setOptions([]);
        return;
      }
      if (isAsyncOptions(src)) {
        const result = await src(query);
        if (alive) setOptions(result);
      } else {
        const q = query.toLowerCase();
        setOptions(src.filter(o => o.toLowerCase().includes(q)));
      }
    })();
    return () => {
      alive = false;
    };
  }, [src, query]);
  return options;
}

export function SmartSearchBar({ schema, onChange, placeholder }: SmartSearchBarProps) {
  const [text, setText] = useState('');
  const [chips, setChips] = useState<AstNode[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState('');
  const [menuIndex, setMenuIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fields = useMemo(() => Object.keys(schema), [schema]);
  const labelToField = useMemo(() => {
    const map: Record<string, string> = {};
    for (const key of fields) {
      map[schema[key].label.toLowerCase()] = key;
      map[key.toLowerCase()] = key;
    }
    return map;
  }, [fields, schema]);
  const field = activeField ? schema[activeField] : undefined;
  const ops = field ? getOps(field.type) : [];
  const options = useOptions(field?.options, valueDraft);

  useEffect(() => {
    const group: AstNode | null = chips.length
      ? { kind: 'group', op: 'and', children: chips }
      : null;
    onChange?.(group, text);
  }, [chips, onChange, text]);

  function resetDraft() {
    setActiveField(null);
    setActiveOp(null);
    setValueDraft('');
    setMenuIndex(0);
  }

  function commitCondition(fieldName: string, op: string, value: string) {
    const node: AstNode = { kind: 'condition', field: fieldName, op, value };
    setChips(prev => [...prev, node]);
    resetDraft();
    setText('');
    inputRef.current?.focus();
    setShowSuggestions(false);
  }

  // Default operator helper reserved for future quick-pick flows (intentionally unused)

  const fieldSuggestions = (!activeField && text.length > 0)
    ? fields
        .filter(f => f.toLowerCase().includes(text.toLowerCase()))
        .map(f => ({ id: f, label: `${schema[f].label}` }))
    : [];

  const opSuggestions = (activeField && !activeOp)
    ? ops
        .filter(o => text.length === 0 || o.startsWith(text))
        .map(o => ({ id: o, label: o }))
    : [];

  const valueSuggestions =
    activeField && (field?.type === 'enum' || field?.type === 'relation' || field?.type === 'boolean')
      ? options.map(o => ({ id: o, label: o }))
      : [];

  const suggestions = activeField
    ? activeOp
      ? valueSuggestions
      : opSuggestions
    : fieldSuggestions;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setMenuIndex(i => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return (next + suggestions.length) % suggestions.length;
      });
      return;
    }
    if (e.key === 'Enter') {
      if (!activeField) {
        const chosen = suggestions[menuIndex]?.id || text;
        if (fields.includes(chosen)) {
          setActiveField(chosen);
          setText('');
          setMenuIndex(0);
          return;
        }
      } else if (!activeOp) {
        const chosen = suggestions[menuIndex]?.id || text;
        if (ops.includes(chosen)) {
          setActiveOp(chosen);
          setText('');
          setMenuIndex(0);
          return;
        }
      } else {
        if (valueSuggestions.length) {
          const chosen = suggestions[menuIndex]?.id || text;
          commitCondition(activeField, activeOp, chosen);
          return;
        }
        const valueToUse = text.trim() || valueDraft.trim();
        if (valueToUse) {
          commitCondition(activeField, activeOp, valueToUse);
          return;
        }
      }
    }
    if (e.key === 'Escape') {
      resetDraft();
    }
  }

  function removeChip(idx: number) {
    setChips(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <div className="search-wrapper" style={{ position: 'relative' }}>
      <div className="smartsearch-container focus-ring" role="combobox" aria-expanded={showSuggestions && suggestions.length > 0}>
        <div className="smartsearch-chips">
          {chips.map((chip, i) => (
            <span key={i} className="chip" aria-label="filter-chip" style={{ alignItems: 'center' }}>
              <span className="label">{schema[(chip as any).field]?.label || (chip as any).field}:</span>
              <span
                className="operator"
                title="Change operator"
                onClick={() => {
                  setActiveField((chip as any).field);
                  setActiveOp(null); // force operator dropdown
                  setText('');
                  setMenuIndex(0);
                  setShowSuggestions(true);
                }}
                style={{ cursor:'pointer' }}
              >
                {(chip as any).op}
              </span>
              <span>{(chip as any).value}</span>
              <button className="icon-button" onClick={() => removeChip(i)} aria-label="Remove" style={{display:'grid',placeItems:'center'}}>×</button>
            </span>
          ))}
          {activeField && activeOp && (
            <span className="chip" style={{ alignItems: 'center' }}>
              <span className="label">{schema[activeField].label}:</span>
              {activeOp && <span className="operator">{activeOp}</span>}
              {!valueSuggestions.length && activeOp && (
                <input
                  value={valueDraft}
                  onChange={e => setValueDraft(e.target.value)}
                  placeholder={field?.type === 'number' ? '123' : field?.type === 'date' ? 'YYYY-MM-DD' : 'value'}
                  className="smartsearch-input"
                  style={{ width: 120 }}
                />
              )}
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          className="smartsearch-input"
          value={text}
          onChange={e => {
            const v = e.target.value;
            // If the user starts with a field name, auto-select field and default operator
            if (!activeField) {
              const parts = v.trimStart().split(/\s+/);
              const maybe = parts[0]?.toLowerCase();
              const matchedField = maybe && labelToField[maybe];
              if (matchedField) {
                setActiveField(matchedField);
                // Wait for explicit operator selection; do not set a default yet
                const rest = v.slice(v.toLowerCase().indexOf(maybe) + maybe.length).trimStart();
                setText(rest);
                setShowSuggestions(true);
                return;
              }
            }
            setText(v);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          placeholder={placeholder || 'Type here'}
          aria-activedescendant={suggestions[menuIndex]?.id}
        />
        {(chips.length > 0 || activeField) && (
          <button className="clear-btn" onClick={() => { setChips([]); resetDraft(); setText(''); }}>
            Clear
          </button>
        )}
      </div>
      <button className="search-btn focus-ring" aria-label="Search" onClick={() => inputRef.current?.focus()}>🔎</button>
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions dropdown" role="listbox">
          {suggestions.map((s, i) => (
            <div
              id={s.id}
              key={s.id}
              role="option"
              aria-selected={i === menuIndex}
              className="suggestion"
              onMouseDown={e => {
                e.preventDefault();
                if (!activeField) {
                  setActiveField(s.id);
                  setText('');
                  setMenuIndex(0);
                  setShowSuggestions(true);
                } else if (!activeOp) {
                  setActiveOp(s.id);
                  setText('');
                  setMenuIndex(0);
                  setShowSuggestions(true);
                } else {
                  commitCondition(activeField!, activeOp!, s.id);
                }
              }}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
      <div className="helper">
        Use queries like:
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="chip"><span className="label">name</span> <span className="operator">contains</span> john</span>
          <span className="chip">age <span className="operator">&gt;</span> 30</span>
          <span className="chip">status <span className="operator">=</span> active</span>
          <span className="chip">department <span className="operator">=</span> design</span>
        </div>
      </div>
    </>
  );
}

export default SmartSearchBar;


