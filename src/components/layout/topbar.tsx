import { UserCircle, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopbarProps {
    onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
    return (
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 lg:gap-x-6 glass-panel border-b px-4 sm:px-6 lg:px-8">
            <button type="button" className="-m-2.5 p-2.5 text-muted-foreground lg:hidden hover:text-foreground transition-colors" onClick={onMenuToggle}>
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" aria-hidden="true" />
            </button>

            <div className="flex flex-1 justify-end gap-x-4 lg:gap-x-6">
                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    <ThemeToggle />

                    {/* Separator */}
                    <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-foreground/10" aria-hidden="true" />

                    {/* Profile */}
                    <button type="button" className="-m-1.5 flex items-center p-1.5 focus:outline-none">
                        <span className="sr-only">Open user menu</span>
                        <div className="h-8 w-8 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                            <UserCircle className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <span className="hidden lg:flex lg:items-center">
                            <span className="ml-4 text-sm font-semibold leading-6 text-foreground" aria-hidden="true">
                                Super Admin
                            </span>
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
}
