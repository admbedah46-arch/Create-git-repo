import React, { useState, useEffect, useRef } from 'react';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChangeValue: (val: string) => void;
  debounceMs?: number;
}

export const DebouncedInput: React.FC<DebouncedInputProps> = React.memo(({
  value: propValue,
  onChangeValue,
  debounceMs = 300,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(propValue || '');
  const onChangeValueRef = useRef(onChangeValue);
  onChangeValueRef.current = onChangeValue;

  useEffect(() => {
    setLocalValue(propValue || '');
  }, [propValue]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== propValue) {
        onChangeValueRef.current(localValue);
      }
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [localValue, propValue, debounceMs]);

  return (
    <input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => {
        if (localValue !== propValue) {
          onChangeValueRef.current(localValue);
        }
        if (props.onBlur) props.onBlur(e);
      }}
    />
  );
});

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChangeValue: (val: string) => void;
  debounceMs?: number;
  autoResizing?: boolean;
}

export const DebouncedTextarea: React.FC<DebouncedTextareaProps> = React.memo(({
  value: propValue,
  onChangeValue,
  debounceMs = 300,
  autoResizing = true,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(propValue || '');
  const onChangeValueRef = useRef(onChangeValue);
  onChangeValueRef.current = onChangeValue;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (autoResizing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    setLocalValue(propValue || '');
  }, [propValue]);

  useEffect(() => {
    adjustHeight();
    const handler = setTimeout(() => {
      if (localValue !== propValue) {
        onChangeValueRef.current(localValue);
      }
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [localValue, propValue, debounceMs, autoResizing]);

  return (
    <textarea
      {...props}
      ref={(node) => {
        textareaRef.current = node;
        if (typeof props.ref === 'function') {
          props.ref(node);
        } else if (props.ref) {
          (props.ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      }}
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        adjustHeight();
      }}
      onBlur={(e) => {
        if (localValue !== propValue) {
          onChangeValueRef.current(localValue);
        }
        if (props.onBlur) props.onBlur(e);
      }}
    />
  );
});
