import React, { ReactNode } from 'react';
import styles from './StatusBar.module.css';

export interface StatusBarProps {
  className?: string;
  children: ReactNode;
}

export const StatusBar: React.FC<StatusBarProps> = ({ className = '', children }) => {
  return (
    <div className={`${styles.statusBar} ${className}`.trim()}>
      {children}
    </div>
  );
};

export interface StatusBarItemProps {
  className?: string;
  children: ReactNode;
}

export const StatusBarItem: React.FC<StatusBarItemProps> = ({ className = '', children }) => {
  return (
    <div className={`${styles.item} ${className}`.trim()}>
      {children}
    </div>
  );
};

export const StatusBarSeparator: React.FC = () => {
  return <div className={styles.separator} />;
};
