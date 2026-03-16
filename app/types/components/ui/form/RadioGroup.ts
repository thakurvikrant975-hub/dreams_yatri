import { ReactNode } from "react";

export interface RadioContextType {
  value: string | undefined;
  setValue: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  error?: string;
  success?: boolean;
  className?: string;
  wrapperClassName?: string;
}