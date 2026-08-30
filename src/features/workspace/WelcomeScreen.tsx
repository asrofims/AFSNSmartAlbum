import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useProjectStore } from '../../stores/projectStore';
import { useAppStore } from '../../stores/appStore';
import { Project } from '../../domain/project';
import { formatDimensions } from '../../domain/units';
import welcomeHero from '../../assets/welcome-hero.jpg';
import appLogo from '../../assets/app-logo.png';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const loadRecentProjects = useProjectStore((s) => s.loadRecentProjects);
  const openProjectById = useProjectStore((s) => s.openProjectById);
  const removeRecentProject = useProjectStore((s) => s.removeRecentProject);
  const clearAllRecentProjects = useProjectStore((s) => s.clearAllRecentProjects);
  const appInfo = useAppStore((s) => s.appInfo);

  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  return (
    <div className={styles.welcomeContainer}>
      <div className={styles.welcomeCard}>
        {/* Left Side: Hero Image & Branding Overlay */}
        <div className={styles.heroColumn}>
          <img
            src={welcomeHero}
            alt="Album Design Experience"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay}>
            <div className={styles.brandBadge}>
              <div className={styles.logoIcon}>
                <img src={appLogo} alt="AFSN" className={styles.appLogoImg} />
              </div>
              <span className={styles.engineTag}>AFSUNMEDIA DEV TEAM</span>
            </div>

            <div className={styles.heroTextGroup}>
              <h1 className={styles.heroTitle}>AFSNSmartAlbum</h1>
              <p className={styles.heroSubtitle}>
                Every photograph captures a moment, but a great album preserves a legacy. Unleash your creative vision and transform cherished memories into timeless works of art.
              </p>
            </div>

            <div className={styles.heroFooter}>
              <span>{appInfo.version} — Afsunmedia - Asrofims</span>
            </div>
          </div>
        </div>

        {/* Right Side: Actions & Recent Projects List */}
        <div className={styles.contentColumn}>
          <div className={styles.contentHeader}>
            <h2 className={styles.welcomeHeading}>Get Started</h2>
            <p className={styles.welcomeSubheading}>
              Create a new album layout or resume where you left off.
            </p>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionsGroup}>
            <Button
              variant="primary"
              size="md"
              className={styles.primaryActionButton}
              onClick={openNewProject}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Create New Project</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              className={styles.secondaryActionButton}
              onClick={async () => {
                await useProjectStore.getState().importProjectFromAfsn();
              }}
              title="Open an exported .afsn or .zip project file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
              </svg>
              <span>Open Project</span>
            </Button>
          </div>

          {/* Recent Projects Section */}
          <div className={styles.recentSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Recent Projects</span>
                {recentProjects.length > 0 && (
                  <span className={styles.countBadge}>{recentProjects.length}</span>
                )}
              </div>
              {recentProjects.length > 0 && (
                <button
                  type="button"
                  className={styles.clearAllBtn}
                  onClick={() => setIsClearAllDialogOpen(true)}
                  title="Clear all recent projects from history"
                >
                  Clear History
                </button>
              )}
            </div>

            {recentProjects.length > 0 ? (
              <div className={styles.recentList}>
                {recentProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className={styles.recentItem}
                    onClick={() => openProjectById(proj.id)}
                    title={`Open ${proj.name}`}
                  >
                    <div className={styles.projectIconBadge}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                    </div>
                    <div className={styles.projectInfo}>
                      <span className={styles.projectName}>{proj.name}</span>
                      <span className={styles.projectDetails}>
                        {formatDimensions(proj.canvasWidth, proj.canvasHeight, proj.canvasUnit)} • {proj.canvasDpi} DPI
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={styles.projectDate}>
                        {new Date(proj.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <button
                        type="button"
                        className={styles.deleteItemBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(proj);
                        }}
                        title="Remove from recent list"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📂</div>
                <span>No recent albums yet. Click above to create your first layout!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Confirmation Dialog: Clear All History */}
      <ConfirmDialog
        isOpen={isClearAllDialogOpen}
        title="Clear Recent Projects"
        message="Are you sure you want to clear all projects from the recent list?"
        detail="This will remove the projects from the internal database. Your original photo files and any exported .afsn / .zip files on your computer remain completely safe."
        confirmText="Clear History"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          await clearAllRecentProjects();
          setIsClearAllDialogOpen(false);
        }}
        onCancel={() => setIsClearAllDialogOpen(false)}
      />

      {/* Modern Confirmation Dialog: Remove Single Project */}
      <ConfirmDialog
        isOpen={projectToDelete !== null}
        title="Remove From Recent List"
        message={`Remove "${projectToDelete?.name}" from your recent projects?`}
        detail="This will remove this project from the internal database. Your original photo files and any exported .afsn files on disk remain safe."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (projectToDelete) {
            await removeRecentProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
