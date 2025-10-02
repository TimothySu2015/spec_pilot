import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FlowDefinitionSchema, IFlowDefinition } from '@specpilot/schemas';
import { StepProvider } from './contexts/StepContext';
import { OpenAPIProvider } from './contexts/OpenAPIContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import ToastContainer from './components/Toast';

function App() {
  const methods = useForm<IFlowDefinition>({
    resolver: zodResolver(FlowDefinitionSchema),
    defaultValues: {
      name: '',
      description: '',
      version: '1.0.0',
      baseUrl: '',
      variables: {},
      steps: [],
    },
  });

  return (
    <ToastProvider>
      <FormProvider {...methods}>
        <OpenAPIProvider>
          <StepProvider>
            <Layout />
            <ToastContainer />
          </StepProvider>
        </OpenAPIProvider>
      </FormProvider>
    </ToastProvider>
  );
}

export default App;
