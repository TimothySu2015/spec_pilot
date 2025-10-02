import { createContext, useContext, useState, ReactNode } from 'react';

interface OpenAPIContextType {
  openApiSpec: any | null;
  setOpenApiSpec: (spec: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const OpenAPIContext = createContext<OpenAPIContextType | undefined>(undefined);

export function OpenAPIProvider({ children }: { children: ReactNode }) {
  const [openApiSpec, setOpenApiSpec] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <OpenAPIContext.Provider value={{ openApiSpec, setOpenApiSpec, isLoading, setIsLoading }}>
      {children}
    </OpenAPIContext.Provider>
  );
}

export function useOpenAPI() {
  const context = useContext(OpenAPIContext);
  if (!context) {
    throw new Error('useOpenAPI must be used within OpenAPIProvider');
  }
  return context;
}
