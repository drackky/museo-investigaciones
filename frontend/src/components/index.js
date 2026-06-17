// Layout Components
export { default as Layout } from './Layout';
export { default as Header } from './Header';
export { default as Sidebar } from './Sidebar';

// Authentication & Guards
export { default as AuthGuard, ResearcherGuard, PrivateRoute, PublicRoute } from './AuthGuard';

// Notifications
export { default as NotificationProvider, useNotifications, NOTIFICATION_TYPES } from './NotificationProvider';

// Loading Components
export {
  Spinner,
  LoadingOverlay,
  LoadingInline,
  ButtonLoading,
  SkeletonItem,
  SkeletonList,
  SkeletonCard,
  LoadingPage,
  useLoading
} from './Loading';

// Import components for default export
import Layout from './Layout';
import Header from './Header';
import Sidebar from './Sidebar';
import AuthGuard, { ResearcherGuard, PrivateRoute, PublicRoute } from './AuthGuard';
import NotificationProvider, { useNotifications, NOTIFICATION_TYPES } from './NotificationProvider';
import {
  Spinner,
  LoadingOverlay,
  LoadingInline,
  ButtonLoading,
  SkeletonItem,
  SkeletonList,
  SkeletonCard,
  LoadingPage,
  useLoading
} from './Loading';

// Re-export everything as default for convenience
export default {
  Layout,
  Header,
  Sidebar,
  AuthGuard,
  ResearcherGuard,
  PrivateRoute,
  PublicRoute,
  NotificationProvider,
  useNotifications,
  NOTIFICATION_TYPES,
  Spinner,
  LoadingOverlay,
  LoadingInline,
  ButtonLoading,
  SkeletonItem,
  SkeletonList,
  SkeletonCard,
  LoadingPage,
  useLoading
};