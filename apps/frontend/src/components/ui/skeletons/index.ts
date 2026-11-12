/**
 * Replica skeletons: placeholders that copy the real page's containers and only
 * swap the content for bars, so nothing moves when the data arrives.
 *
 * Built on the primitive in `components/ui/skeleton` (bg-muted fill, a
 * shimmer that switches off under prefers-reduced-motion). Compose these per
 * route in `components/skeletons/*`.
 */
export { SkeletonRegion, Repeat } from './region';
export {
  CommandBarSkeleton,
  PageHeaderSkeleton,
  KpiCardSkeleton,
  KpiGridSkeleton,
  StatStripSkeleton,
  ToolbarSkeleton,
  PillTabsSkeleton,
  SelectSkeleton,
  SegmentedToggleSkeleton,
  TableCardSkeleton,
  PaginationFooterSkeleton,
  PanelSkeleton,
  PanelListSkeleton,
  FieldSkeleton,
  FormSectionSkeleton,
  SectionNavSkeleton,
  FormLayoutSkeleton,
  type FormRowShape,
  type BarActionShape,
  type CellShape,
  type ColumnSpec,
} from './admin-chrome';
export {
  EditorShellSkeleton,
  EditorHeaderSkeleton,
  EditorRailSkeleton,
  EditorSectionSkeleton,
  AsideCardSkeleton,
  AsidePreviewSkeleton,
  AsideChecksSkeleton,
  type EditorRowShape,
  type EditorSectionShape,
} from './editor-shell';
export { CardGridSkeleton } from './card-grid';
export {
  LanguageLineSkeleton,
  DifficultyBarSkeleton,
  CourseCardSkeleton,
  CourseGridSkeleton,
  CourseFilterSkeleton,
  PublicPageHeaderSkeleton,
  EnrollmentRowSkeleton,
  CertificateRowSkeleton,
  CertificateListSkeleton,
} from './public';
