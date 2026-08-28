import React, { ReactNode } from 'react';
import styles from './Toolbar.module.css';

export interface ToolbarProps {
  className?: string;
  children: ReactNode;
}

export const Toolbar: React.FC<ToolbarProps> = ({ className = '', children }) => {
  return (
    <div className={`${styles.toolbar} ${className}`.trim()} data-tauri-drag-region>
      {children}
    </div>
  );
};

export const ToolbarSeparator: React.FC = () => {
  return <div className={styles.separator} />;
};

export interface ToolbarGroupProps {
  className?: string;
  children: ReactNode;
}

export const ToolbarGroup: React.FC<ToolbarGroupProps> = ({ className = '', children }) => {
  return (
    <div className={`${styles.group} ${className}`.trim()}>
      {children}
    </div>
  );
};
