"use client";

import {
  createContext, useContext, useState,
  useCallback, type ReactNode, Fragment,
} from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import {
  ChevronLeft, ChevronRight,
  Check, Loader2, AlertCircle,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type SheetStep = {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  optional?: boolean;
  validate?: (data: Record<string, unknown>) => string | null;
};

type MultiStepSheetContextValue = {
  currentStep: number;
  totalSteps: number;
  stepData: Record<string, Record<string, unknown>>;
  setStepData: (stepId: string, data: Record<string, unknown>) => void;
  goNext: () => void;
  goPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  stepError: string | null;
  clearError: () => void;
  allData: Record<string, unknown>;
};

// ── Context ────────────────────────────────────────────────────────────────

const MultiStepSheetContext = createContext<MultiStepSheetContextValue | null>(null);

export function useMultiStepSheet() {
  const ctx = useContext(MultiStepSheetContext);
  if (!ctx) throw new Error("useMultiStepSheet must be used inside <MultiStepSheet>");
  return ctx;
}

// ── Step Indicator (horizontal, same pattern as MultiStepModal) ────────────

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  errorStep,
}: {
  steps: SheetStep[];
  currentStep: number;
  completedSteps: Set<number>;
  errorStep: number | null;
}) {
  return (
    <div className="flex flex-row gap-4 w-full">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStep;
        const isError = errorStep === index;
        const isPending = !isCompleted && !isCurrent;

        return (
          <Fragment key={step.id}>
            <div className="flex flex-col gap-2 items-center">
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-200",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && !isError && "bg-background border-primary text-primary",
                  isError && "bg-destructive/10 border-destructive text-destructive",
                  isPending && "bg-muted border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isError ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap max-w-16 text-center leading-tight",
                  isCurrent && "text-primary",
                  isCompleted && "text-muted-foreground",
                  isPending && "text-muted-foreground/60",
                  isError && "text-destructive",
                )}
              >
                {step.title}
                {step.optional && (
                  <span className="block text-[9px] text-muted-foreground/50">Optional</span>
                )}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div className="h-6 flex-1 flex items-center">
                <div
                  className={cn(
                    "w-full h-[0.12em] rounded-full transition-all duration-300",
                    completedSteps.has(index) ? "bg-primary" : "bg-muted",
                  )}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

type MultiStepSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  steps: SheetStep[];
  onComplete: (data: Record<string, unknown>) => Promise<void> | void;
  isSubmitting?: boolean;
  submitLabel?: string;
  initialStepData?: Record<string, Record<string, unknown>>;
  children: ReactNode;
};

export function MultiStepSheet({
  open,
  onOpenChange,
  title,
  description,
  steps,
  onComplete,
  isSubmitting = false,
  submitLabel = "Submit",
  initialStepData = {},
  children,
}: MultiStepSheetProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData, setStepDataState] = useState<Record<string, Record<string, unknown>>>(initialStepData);
  const [stepError, setStepError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<number | null>(null);

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const allData = Object.values(stepData).reduce((acc, d) => ({ ...acc, ...d }), {});

  const setStepData = useCallback((stepId: string, data: Record<string, unknown>) => {
    setStepDataState((prev) => ({ ...prev, [stepId]: data }));
  }, []);

  const clearError = useCallback(() => {
    setStepError(null);
    setErrorStep(null);
  }, []);

  function validate() {
    const validator = steps[currentStep].validate;
    if (!validator) return true;
    const error = validator(allData);
    if (error) {
      setStepError(error);
      setErrorStep(currentStep);
      return false;
    }
    return true;
  }

  function handleNext() {
    if (!validate()) return;
    clearError();
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function handlePrev() {
    clearError();
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleSubmit() {
    if (!validate()) return;
    clearError();
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    await onComplete(allData);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setStepDataState(initialStepData);
      clearError();
    }
    onOpenChange(open);
  }

  const progress =
    ((currentStep + (isLast && completedSteps.has(currentStep) ? 1 : 0)) / steps.length) * 100;

  const childrenArray = Array.isArray(children) ? children : [children];
  const currentChild = childrenArray[currentStep];

  const ctx: MultiStepSheetContextValue = {
    currentStep,
    totalSteps: steps.length,
    stepData,
    setStepData,
    goNext: handleNext,
    goPrev: handlePrev,
    isFirst,
    isLast,
    stepError,
    clearError,
    allData,
  };

  return (
    <MultiStepSheetContext.Provider value={ctx}>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">

          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0 space-y-0">
            <div className="flex items-start justify-between mb-1">
              <div>
                <SheetTitle className="text-base">{title}</SheetTitle>
                {description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs shrink-0 ml-4">
                {currentStep + 1} / {steps.length}
              </Badge>
            </div>

            <Progress value={progress} className="h-[0.2em] mt-2" />

            <div className="mt-4 overflow-x-auto pb-1">
              <StepIndicator
                steps={steps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                errorStep={errorStep}
              />
            </div>
          </SheetHeader>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Step title & icon */}
            <div className="flex items-center gap-2 mb-4">
              {steps[currentStep].icon && (
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {steps[currentStep].icon}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm">{steps[currentStep].title}</h3>
                {steps[currentStep].description && (
                  <p className="text-xs text-muted-foreground">{steps[currentStep].description}</p>
                )}
              </div>
            </div>

            {/* Validation error */}
            {stepError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 mb-4 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            {currentChild}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t bg-muted/30 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handlePrev}
              disabled={isFirst || isSubmitting}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {steps[currentStep].optional && !isLast && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => { clearError(); setCurrentStep((p) => p + 1); }}
                >
                  Skip
                </Button>
              )}

              {isLast ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2 min-w-28"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                  ) : (
                    <><Check className="h-4 w-4" />{submitLabel}</>
                  )}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext} disabled={isSubmitting} className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

        </SheetContent>
      </Sheet>
    </MultiStepSheetContext.Provider>
  );
}
