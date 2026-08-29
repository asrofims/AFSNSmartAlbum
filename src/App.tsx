import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';
import { AboutDialog } from './features/about/AboutDialog';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { NewProjectDialog } from './features/project/NewProjectDialog';

export default function App() {
  return (
    <>
      <WorkspaceLayout />
      <AboutDialog />
      <SettingsDialog />
      <NewProjectDialog />
    </>
  );
}
