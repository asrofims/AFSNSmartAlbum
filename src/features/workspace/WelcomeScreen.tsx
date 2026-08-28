import { useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/projectStore';
import { formatDimensions } from '../../domain/units';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const loadRecentProjects = useProjectStore((s) => s.loadRecentProjects);
  const openProjectById = useProjectStore((s) => s.openProjectById);
  const removeRecentProject = useProjectStore((s) => s.removeRecentProject);
  const clearAllRecentProjects = useProjectStore((s) => s.clearAllRecentProjects);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  return (
    <div className={styles.welcomeContainer}>
      <div className={styles.welcomeCard}>
        <div className={styles.header}>
          <div className={styles.logoBadge}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
          <h1 className={styles.appName}>AFSNSmartAlbum</h1>
          <p className={styles.appTagline}>Professional Photo Album Layout Software</p>
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="md"
            className={styles.createButton}
            onClick={openNewProject}
          >
            + Create New Project
          </Button>
        </div>

        <div className={styles.recentSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <span>Recent Projects</span>
              {recentProjects.length > 0 && (
                <span className={styles.countBadge}>{recentProjects.length}</span>
              )}
            </div>
            {recentProjects.length > 0 && (
              <button
                type="button"
                className={styles.clearAllBtn}
                onClick={() => {
                  if (window.confirm('Clear all recent projects history?')) {
                    clearAllRecentProjects();
                  }
                }}
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
                        removeRecentProject(proj.id);
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
              No recent projects. Click above to create your first album!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
