import React, { ReactNode } from 'react';
import styles from './PanelHeader.module.css';

export interface PanelHeaderProps {
  title: string;
  className?: string;
  children?: ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, className = '', children }) => {
  return (
    <div className={`${styles.header} ${className}`.trim()}>
      <span className={styles.title}>{title}</span>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
};
