import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ClipboardList } from 'lucide-react';
import type { Assignment, AssignmentStatus } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';
import { deleteAssignment, patchAssignment } from '../data/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';

const statusStyles: Record<AssignmentStatus, string> = {
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Returned: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
};

type EditableAssignmentFields = Pick<
  Assignment,
  | 'brand'
  | 'area'
  | 'department'
  | 'site'
  | 'startDate'
  | 'returnDate'
  | 'hostname'
  | 'usb_status'
  | 'usb'
  | 'user'
  | 'username'
  | 'full_name'
  | 'service'
  | 'ws_sn'
  | 'ws_model'
  | 'nb_sn'
  | 'model_nb'
  | 'mac_address'
  | 'os'
  | 'immo_ws'
  | 'immo_number'
  | 'bci_ws'
  | 'bci'
  | 'acquisition_date'
  | 'assignment_date'
  | 'end_of_support_date'
  | 'monitor_model'
  | 'monitor_sn'
  | 'monitor_immo'
  | 'monitor_bci'
>;

function toInputValue(value: unknown): string {
  const v = String(value ?? '').trim();
  return v;
}

function buildPatch(original: Assignment, next: EditableAssignmentFields): Partial<EditableAssignmentFields> {
  const patch: Partial<EditableAssignmentFields> = {};
  (Object.keys(next) as (keyof EditableAssignmentFields)[]).forEach((key) => {
    const before = toInputValue((original as any)[key]);
    const after = toInputValue((next as any)[key]);
    if (before !== after) {
      (patch as any)[key] = after ? after : null;
    }
  });
  return patch;
}

function getSafeStatus(a: Assignment): AssignmentStatus {
  const s = String(a.status ?? '').trim() as AssignmentStatus;
  if (s === 'Pending' || s === 'Active' || s === 'Returned') return s;
  return 'Pending';
}

export function AssignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assignments, assets, refreshAll, loading } = useData();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageAssignments = canPerformAction(role, 'manage_assignments');

  const assignment = useMemo(() => assignments.find((a) => a.id === id), [assignments, id]);
  const linkedAsset = useMemo(() => {
    const assetId = assignment?.assetId;
    if (!assetId) return null;
    return assets.find((a) => a.id === assetId) ?? null;
  }, [assets, assignment?.assetId]);

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EditableAssignmentFields>(() => ({} as any));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const didTryRefresh = useRef(false);
  useEffect(() => {
    if (assignment) return;
    if (loading) return;
    if (didTryRefresh.current) return;
    didTryRefresh.current = true;
    void refreshAll();
  }, [assignment, loading, refreshAll]);

  useEffect(() => {
    if (!assignment) return;
    setEditMode(false);
    setForm({
      brand: assignment.brand ?? '',
      area: assignment.area ?? '',
      department: assignment.department ?? '',
      site: assignment.site ?? '',
      startDate: assignment.startDate ?? '',
      returnDate: assignment.returnDate ?? '',
      hostname: assignment.hostname ?? '',
      usb_status: assignment.usb_status ?? '',
      usb: assignment.usb ?? '',
      user: assignment.user ?? '',
      username: assignment.username ?? '',
      full_name: assignment.full_name ?? '',
      service: assignment.service ?? '',
      ws_sn: assignment.ws_sn ?? '',
      ws_model: assignment.ws_model ?? '',
      nb_sn: assignment.nb_sn ?? '',
      model_nb: assignment.model_nb ?? '',
      mac_address: assignment.mac_address ?? '',
      os: assignment.os ?? '',
      immo_ws: assignment.immo_ws ?? '',
      immo_number: assignment.immo_number ?? '',
      bci_ws: assignment.bci_ws ?? '',
      bci: assignment.bci ?? '',
      acquisition_date: assignment.acquisition_date ?? '',
      assignment_date: assignment.assignment_date ?? '',
      end_of_support_date: assignment.end_of_support_date ?? '',
      monitor_model: assignment.monitor_model ?? '',
      monitor_sn: assignment.monitor_sn ?? '',
      monitor_immo: assignment.monitor_immo ?? '',
      monitor_bci: assignment.monitor_bci ?? '',
    });
  }, [assignment]);

  const status = assignment ? getSafeStatus(assignment) : 'Pending';
  const deviceCategory = String(assignment?.device_category ?? '').trim();

  const fieldsCommon: Array<{ key: keyof EditableAssignmentFields; label: string }>
    = [
      { key: 'brand', label: 'Brand' },
      { key: 'department', label: 'Department' },
      { key: 'site', label: 'Site' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'returnDate', label: 'Return Date' },
      { key: 'assignment_date', label: 'Assignment Date' },
    ];

  const fieldsWorkstation: Array<{ key: keyof EditableAssignmentFields; label: string }> = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'usb_status', label: 'USB Status' },
    { key: 'user', label: 'User' },
    { key: 'full_name', label: 'Full Name' },
    { key: 'service', label: 'Service' },
    { key: 'ws_sn', label: 'WS Serial' },
    { key: 'ws_model', label: 'WS Model' },
    { key: 'os', label: 'OS' },
    { key: 'immo_ws', label: 'IMMO' },
    { key: 'bci_ws', label: 'BCI' },
    { key: 'acquisition_date', label: 'Acquisition Date' },
    { key: 'end_of_support_date', label: 'End of Support Date' },
    { key: 'monitor_model', label: 'Monitor Model' },
    { key: 'monitor_sn', label: 'Monitor Serial' },
    { key: 'monitor_immo', label: 'Monitor IMMO' },
    { key: 'monitor_bci', label: 'Monitor BCI' },
  ];

  const fieldsNotebook: Array<{ key: keyof EditableAssignmentFields; label: string }> = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'usb', label: 'USB' },
    { key: 'username', label: 'Username' },
    { key: 'full_name', label: 'Full Name' },
    { key: 'service', label: 'Service' },
    { key: 'nb_sn', label: 'NB Serial' },
    { key: 'model_nb', label: 'NB Model' },
    { key: 'mac_address', label: 'MAC Address' },
    { key: 'os', label: 'OS' },
    { key: 'immo_number', label: 'IMMO' },
    { key: 'bci', label: 'BCI' },
    { key: 'acquisition_date', label: 'Acquisition Date' },
    { key: 'end_of_support_date', label: 'End of Support Date' },
    { key: 'monitor_model', label: 'Monitor Model' },
    { key: 'monitor_sn', label: 'Monitor Serial' },
    { key: 'monitor_immo', label: 'Monitor IMMO' },
    { key: 'monitor_bci', label: 'Monitor BCI' },
  ];

  const fieldsPrinter: Array<{ key: keyof EditableAssignmentFields; label: string }> = [
    { key: 'area', label: 'Area' },
    { key: 'hostname', label: 'Printer Name / Hostname' },
  ];

  const effectiveFields = useMemo(() => {
    if (deviceCategory === 'Workstation') return [...fieldsCommon, ...fieldsWorkstation];
    if (deviceCategory === 'Notebook') return [...fieldsCommon, ...fieldsNotebook];
    if (deviceCategory === 'Printer') return [...fieldsCommon, ...fieldsPrinter];
    return fieldsCommon;
  }, [deviceCategory]);

  const onSave = async () => {
    if (!assignment) return;
    if (!canManageAssignments) return;
    if (isSaving) return;

    const patch = buildPatch(assignment, form);
    if (Object.keys(patch).length === 0) {
      setEditMode(false);
      toast.info('No changes');
      return;
    }

    try {
      setIsSaving(true);
      await patchAssignment(assignment.id, patch as any);
      await refreshAll();
      setEditMode(false);
      toast.success('Assignment updated');
    } catch (e: any) {
      toast.error(String(e?.message ?? 'Unable to update assignment'));
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!assignment) return;
    if (!canManageAssignments) return;
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      await deleteAssignment(assignment.id);
      await refreshAll();
      toast.success('Assignment deleted');
      navigate('/assignments');
    } catch (e: any) {
      toast.error(String(e?.message ?? 'Unable to delete assignment'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!id) {
    return (
      <div className="p-6">
        <div className="text-lg font-semibold">Assignment</div>
        <div className="mt-2 text-muted-foreground">Missing assignment id.</div>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/assignments">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link to="/assignments">Back</Link>
          </Button>
          <div>
            <div className="text-lg font-semibold">Assignment</div>
            <div className="text-sm text-muted-foreground">Not found.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="page-hero">
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <Button asChild variant="outline" className="mb-4">
              <Link to="/assignments">Back</Link>
            </Button>

            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <ClipboardList className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Assignments</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
                    {status}
                  </span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Assignment #{assignment.id}
                    </span>
                    <span className="page-hero__title-text">Assignment #{assignment.id}</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">
                  {deviceCategory ? `${deviceCategory}` : 'Assignment'}
                  {linkedAsset?.assetTag ? ` • Asset: ${linkedAsset.assetTag}` : assignment.assetId ? ` • AssetId: ${assignment.assetId}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="page-hero__actions">
            {canManageAssignments && (
              <>
                {!editMode ? (
                  <Button variant="outline" onClick={() => setEditMode(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setEditMode(false)} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button onClick={() => void onSave()} disabled={isSaving}>
                      {isSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete assignment</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the assignment. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void onDelete()}>
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">User / Area</div>
            <div className="font-medium">{String(assignment.userName ?? '—')}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Approved</div>
            <div className="font-medium">
              {assignment.approvedBy ? `By ${assignment.approvedBy}` : '—'}
              {assignment.approvedAt ? ` • ${assignment.approvedAt}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-lg font-semibold mb-4">Information</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {effectiveFields.map((f) => {
            const value = toInputValue((form as any)[f.key]);
            return (
              <div key={String(f.key)} className="space-y-2">
                <Label>{f.label}</Label>
                {editMode && canManageAssignments ? (
                  <Input
                    value={value}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value } as any))}
                  />
                ) : (
                  <div className="h-9 px-3 flex items-center rounded-md border border-border bg-background text-sm">
                    {value || '—'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
