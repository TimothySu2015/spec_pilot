import OpenAPIUpload from '../openapi/OpenAPIUpload';
import StepList from '../step/StepList';

export default function Sidebar() {
  return (
    <div className="h-full flex flex-col">
      <OpenAPIUpload />
      <StepList />
    </div>
  );
}
