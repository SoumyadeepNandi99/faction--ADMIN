"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
};

let resolvePromise: ((value: boolean) => void) | null = null;

export const confirmAction = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
        resolvePromise = resolve;
        const event = new CustomEvent("open-confirm-modal", { detail: options });
        window.dispatchEvent(event);
    });
};

export function GlobalConfirmModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const customEvent = e as CustomEvent<ConfirmOptions>;
            setOptions(customEvent.detail);
            setIsOpen(true);
        };
        window.addEventListener("open-confirm-modal", handleOpen);
        return () => window.removeEventListener("open-confirm-modal", handleOpen);
    }, []);

    const handleClose = (confirmed: boolean) => {
        setIsOpen(false);
        if (resolvePromise) resolvePromise(confirmed);
        resolvePromise = null;
    };

    if (!isOpen || !options) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-(--border) bg-background p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <button
                    onClick={() => handleClose(false)}
                    className="absolute right-4 top-4 rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-muted transition-all"
                >
                    <X className="h-5 w-5" />
                </button>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${options.destructive !== false ? 'bg-destructive/10 text-destructive' : 'bg-brand-500/10 text-brand-500'}`}>
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold tracking-tight text-foreground">{options.title}</h3>
                        <p className="text-sm text-muted-foreground">{options.description}</p>
                    </div>
                </div>
                <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                        onClick={() => handleClose(false)}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-muted text-foreground transition-colors w-full sm:w-auto"
                    >
                        {options.cancelText || "Cancel"}
                    </button>
                    <button
                        onClick={() => handleClose(true)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors w-full sm:w-auto shadow-sm ${options.destructive !== false ? 'bg-destructive hover:bg-destructive/90' : 'bg-brand-600 hover:bg-brand-700'}`}
                    >
                        {options.confirmText || "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}
