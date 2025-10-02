import { createContext, useContext, useState, ReactNode } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';

interface StepContextType {
  activeStepIndex: number | null;
  setActiveStepIndex: (index: number | null) => void;
  fields: any[];
  append: (value: any) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
}

const StepContext = createContext<StepContextType | undefined>(undefined);

export function StepProvider({ children }: { children: ReactNode }) {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const { control } = useFormContext<IFlowDefinition>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'steps',
  });

  return (
    <StepContext.Provider value={{
      activeStepIndex,
      setActiveStepIndex,
      fields,
      append,
      remove,
      move,
    }}>
      {children}
    </StepContext.Provider>
  );
}

export function useStepContext() {
  const context = useContext(StepContext);
  if (!context) {
    throw new Error('useStepContext must be used within StepProvider');
  }
  return context;
}
