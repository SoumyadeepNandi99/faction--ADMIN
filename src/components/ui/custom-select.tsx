"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
    label: string;
    value: string;
}

interface CustomSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function CustomSelect({ options, value, onChange, placeholder = "Select...", className, disabled }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    const selectedOption = options.find((opt) => opt.value === value);

    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        updatePosition();

        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        }

        function handleScroll() {
            updatePosition();
        }

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [isOpen, updatePosition]);

    return (
        <div className={cn("relative w-full", className)}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => {
                    if (!disabled) {
                        if (!isOpen) updatePosition();
                        setIsOpen(!isOpen);
                    }
                }}
                disabled={disabled}
                className={cn(
                    "w-full flex items-center justify-between bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm",
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-foreground/5"
                )}
            >
                <span className={!selectedOption ? "text-muted-foreground" : ""}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && !disabled && typeof document !== "undefined" && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: "fixed",
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        zIndex: 9999,
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                        maxHeight: "15rem",
                        overflowY: "auto",
                        padding: "0.25rem 0",
                    }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.5rem 0.75rem",
                                fontSize: "0.875rem",
                                textAlign: "left",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >   
                            <span style={{
                                fontWeight: value === option.value ? 600 : 400,
                                color: value === option.value ? "var(--primary)" : "var(--card-foreground)",
                            }}>
                             {option.label}
                            </span>
                            {value === option.value && <Check className="h-4 w-4" style={{ color: "var(--primary)" }} />}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
