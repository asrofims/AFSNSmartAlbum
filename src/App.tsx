import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';
import { AboutDialog } from './features/about/AboutDialog';
import { NewProjectDialog } from './features/project/NewProjectDialog';

export default function App() {
  return (
    <>
      <WorkspaceLayout />
      <AboutDialog />
      <NewProjectDialog />
    </>
  );
}
