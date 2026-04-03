"use client";

import {
  createContext, useContext, useState,
  useCallback, type ReactNode,
} from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "../ui/dialog";
import { Button }   from "../ui/button";
import { Progress } from "../ui/progress";
import { Badge }    from "../ui/badge";
import {
  ChevronLeft, ChevronRight,
  Check, Loader2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "current" | "completed" | "error";

export type Step = {
  id:           string;
  title:        string;
  description?: string;
  icon?:        ReactNode;
  optional?:    boolean;
  validate?:    (data: Record<string, unknown>) => string | null;
};

type MultiStepContextValue = {
  currentStep:  number;
  totalSteps:   number;
  stepData:     Record<string, Record<string, unknown>>;
  setStepData:  (stepId: string, data: Record<string, unknown>) => void;
  goNext:       () => void;
  goPrev:       () => void;
  goToStep:     (index: number) => void;
  isFirst:      boolean;
  isLast:       boolean;
  stepError:    string | null;
  clearError:   () => void;
  allData:      Record<string, unknown>;
};

// ── Context ───────────────────────────────────────────────────────────────

const MultiStepContext = createContext<MultiStepContextValue | null>(null);

export function useMultiStep() {
  const ctx = useContext(MultiStepContext);
  if (!ctx) throw new Error("useMultiStep must be used inside <MultiStepModal>");
  return ctx;
}

// ── Step Indicator ────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  errorStep,
}: {
  steps:          Step[];
  currentStep:    number;
  completedSteps: Set<number>;
  errorStep:      number | null;
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent   = index === currentStep;
        const isError     = errorStep === index;
        const isPending   = !isCompleted && !isCurrent;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-200",
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
                  isCurrent   && "text-primary",
                  isCompleted && "text-muted-foreground",
                  isPending   && "text-muted-foreground/60",
                  isError     && "text-destructive",
                )}
              >
                {step.title}
                {step.optional && (
                  <span className="block text-[9px] text-muted-foreground/50">Optional</span>
                )}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-[2px] w-8 mx-1 mb-5 rounded-full transition-all duration-300",
                  completedSteps.has(index) ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

type MultiStepModalProps = {
  open:             boolean;
  onOpenChange:     (open: boolean) => void;
  title:            string;
  description?:     string;
  steps:            Step[];
  onComplete:       (data: Record<string, unknown>) => Promise<void> | void;
  isSubmitting?:    boolean;
  submitLabel?:     string;
  initialStepData?: Record<string, Record<string, unknown>>;  // ← pre-seed for edit
  children:         ReactNode;
};

export function MultiStepModal({
  open,
  onOpenChange,
  title,
  description,
  steps,
  onComplete,
  isSubmitting    = false,
  submitLabel     = "Submit",
  initialStepData = {},
  children,
}: MultiStepModalProps) {
  const [currentStep,    setCurrentStep]    = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData,       setStepDataState]  = useState<Record<string, Record<string, unknown>>>(
    initialStepData   // ← seeded from prop
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<number | null>(null);

  const isFirst = currentStep === 0;
  const isLast  = currentStep === steps.length - 1;

  // Flatten all step data
  const allData = Object.values(stepData).reduce((acc, d) => ({ ...acc, ...d }), {});

  const setStepData = useCallback((stepId: string, data: Record<string, unknown>) => {
    setStepDataState(prev => ({ ...prev, [stepId]: data }));
  }, []);

  const clearError = useCallback(() => {
    setStepError(null);
    setErrorStep(null);
  }, []);

  function validate() {
    const step      = steps[currentStep];
    const validator = step.validate;
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
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }

  function handlePrev() {
    clearError();
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }

  function goToStep(index: number) {
    if (completedSteps.has(index) || index === currentStep) {
      clearError();
      setCurrentStep(index);
    }
  }

  async function handleSubmit() {
    if (!validate()) return;
    clearError();
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    await onComplete(allData);
  }

  function handleClose(open: boolean) {
    if (!open) {
      // Reset to initial state
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setStepDataState(initialStepData);  // ← reset to initial, not {}
      clearError();
    }
    onOpenChange(open);
  }

  const progress = ((currentStep + (isLast && completedSteps.has(currentStep) ? 1 : 0)) / steps.length) * 100;

  // Get only the current step's child
  const childrenArray = Array.isArray(children) ? children : [children];
  const currentChild  = childrenArray[currentStep];

  const contextValue: MultiStepContextValue = {
    currentStep,
    totalSteps: steps.length,
    stepData,
    setStepData,
    goNext:     handleNext,
    goPrev:     handlePrev,
    goToStep,
    isFirst,
    isLast,
    stepError,
    clearError,
    allData,
  };

  return (
    <MultiStepContext.Provider value={contextValue}>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg">{title}</DialogTitle>
                {description && (
                  <DialogDescription className="mt-1">{description}</DialogDescription>
                )}
              </div>
              <Badge variant="outline" className="text-xs shrink-0 ml-4">
                Step {currentStep + 1} of {steps.length}
              </Badge>
            </div>

            <Progress value={progress} className="h-1.5 mt-3" />

            <div className="flex justify-center mt-4 overflow-x-auto pb-1">
              <StepIndicator
                steps={steps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                errorStep={errorStep}
              />
            </div>
          </DialogHeader>

          {/* Step content — only current child */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                {steps[currentStep].icon && (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {steps[currentStep].icon}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-base">{steps[currentStep].title}</h3>
                  {steps[currentStep].description && (
                    <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
                  )}
                </div>
              </div>
            </div>

            {stepError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 mb-4 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            {/* ← Only render the current step */}
            {currentChild}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between shrink-0">
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
                  onClick={() => {
                    clearError();
                    setCurrentStep(prev => prev + 1);
                  }}
                >
                  Skip
                </Button>
              )}

              {isLast ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2 min-w-[100px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {submitLabel}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </MultiStepContext.Provider>
  );
}