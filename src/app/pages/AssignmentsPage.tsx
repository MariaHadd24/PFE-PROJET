import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import type { AssignmentStatus, StockMovement } from '../types';
import { AddAssignmentModal } from '../components/ui/AddAssignmentModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../components/ui/utils';
import { canPerformAction } from '../lib/rbac';
import { approveAssignment as approveAssignmentApi, patchAssignment } from '../data/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const pageContainerVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut', when: 'beforeChildren', staggerChildren: 0.05 },
  },
};

const pageItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
};

export function AssignmentsPage() {
  const shouldReduceMotion = useReducedMotion();
  const { assignments, assets, stockMovements, users, departments, sites, addAssignment, clearAssignments, refreshAll } = useData();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageAssignments = canPerformAction(role, 'manage_assignments');
  const canApproveAssignments = canPerformAction(role, 'approve_assignments');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<any | null>(null);
  const [approvePassword, setApprovePassword] = useState('');
  const [approveSignatureData, setApproveSignatureData] = useState('');
  const [approveError, setApproveError] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const approveSignatureInputRef = useRef<HTMLInputElement | null>(null);
  const [modalInitial, setModalInitial] = useState<React.ComponentProps<typeof AddAssignmentModal>['initial']>(undefined);
  const [assignmentsList, setAssignmentsList] = useState(assignments);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const { addNotification } = useNotifications();

  const closeApproveModal = () => {
    setIsApproveOpen(false);
    setApproveTarget(null);
    setApprovePassword('');
    setApproveSignatureData('');
    setApproveError('');
    setIsApproving(false);
  };

  const handleApproveSignatureFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setApproveError('Signature: choisissez une image');
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });

    setApproveSignatureData(dataUrl);
    if (approveError) setApproveError('');
  };

  const CATEGORY_TABS = useMemo(() => ['Workstation', 'Notebook', 'Printer'] as const, []);

  const fmt = (v: any) => {
    if (v === undefined || v === null) return '-';
    const s = String(v).trim();
    return s ? s : '-';
  };

  const norm = (v: any) => String(v ?? '').trim().toLowerCase();

  const getCategory = (a: any) => fmt(a.device_category);
  const getAssetCategory = (a: any) => {
    const asset = a?.assetId ? assets.find((x) => x.id === a.assetId) : undefined;
    if (asset?.category) return fmt(asset.category);
    return '-';
  };
  const getHostname = (a: any) => {
    const direct = String(a?.hostname ?? '').trim();
    if (direct) return direct;

    const asset = getAsset(a);
    const fromProfile = String((asset as any)?.deviceProfile?.hostname ?? '').trim();
    if (fromProfile) return fromProfile;

    const assetTag = String((asset as any)?.assetTag ?? '').trim();
    return assetTag ? assetTag : '-';
  };
  const getUser = (a: any) => {
    const c = norm(a.device_category);
    if (c === 'workstation') return fmt(a.user || a.full_name || a.userName);
    if (c === 'notebook') return fmt(a.username || a.full_name || a.userName);
    if (c === 'printer') return fmt(a.area || a.userName);
    return fmt(a.full_name || a.userName || a.username || a.user);
  };

  const getArea = (a: any) => fmt(a.area || a.userName);

  const getAssetTag = (a: any) => {
    const asset = getAsset(a);
    const assetTag = String((asset as any)?.assetTag ?? '').trim();
    if (assetTag) return assetTag;
    const id = String(a?.assetId ?? '').trim();
    return id ? id : '-';
  };

  const getUsbStatus = (a: any) => fmt(a.usb_status);
  const getUsb = (a: any) => fmt(a.usb);

  const getWsUser = (a: any) => fmt(a.user);
  const getWsFullName = (a: any) => fmt(a.full_name || a.userName);
  const getWsService = (a: any) => fmt(a.service);
  const getWsOs = (a: any) => fmt(a.os);
  const getWsAcquisitionDate = (a: any) => fmt(a.acquisition_date);
  const getWsAssignmentDate = (a: any) => fmt(a.assignment_date || a.startDate);
  const getWsEndOfSupportDate = (a: any) => fmt(a.end_of_support_date);
  const getWsMonitorModel = (a: any) => fmt(a.monitor_model);
  const getWsMonitorSn = (a: any) => fmt(a.monitor_sn);
  const getWsMonitorImmo = (a: any) => fmt(a.monitor_immo);
  const getWsMonitorBci = (a: any) => fmt(a.monitor_bci);

  const getNbUsername = (a: any) => fmt(a.username);
  const getNbFullName = (a: any) => fmt(a.full_name || a.userName);
  const getNbService = (a: any) => fmt(a.service);
  const getNbOs = (a: any) => fmt(a.os);

  const getNbAcquisitionDate = (a: any) => {
    const direct = String(a?.acquisition_date ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.acquisitionDate ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getNbAssignmentDate = (a: any) => fmt(a.assignment_date || a.startDate);
  const getNbEndOfSupportDate = (a: any) => fmt(a.end_of_support_date);

  const getNbSerial = (a: any) => {
    const direct = String(a?.nb_sn ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.serialNumber ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getNbModel = (a: any) => {
    const direct = String(a?.model_nb ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.model ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getNbMac = (a: any) => {
    const direct = String(a?.mac_address ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.macAddress ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getNbImmo = (a: any) => {
    const direct = String(a?.immo_number ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.immoNumber ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getNbBci = (a: any) => {
    const direct = String(a?.bci ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.bci ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getWsSerial = (a: any) => {
    const direct = String(a?.ws_sn ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.serialNumber ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getWsModel = (a: any) => {
    const direct = String(a?.ws_model ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.model ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getWsImmo = (a: any) => {
    const direct = String(a?.immo_ws ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.immoNumber ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getWsBci = (a: any) => {
    const direct = String(a?.bci_ws ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.bci ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getMac = (a: any) => {
    const direct = String(a?.mac_address ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.macAddress ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };
  const getSerial = (a: any) => {
    const asset = getAsset(a);
    const c = norm(a.device_category);
    const fromAssignment =
      c === 'workstation' ? fmt(a.ws_sn) : c === 'notebook' ? fmt(a.nb_sn) : fmt(a.ws_sn || a.nb_sn);

    if (fromAssignment !== '-') return fromAssignment;

    const fromAsset = String((asset as any)?.serialNumber ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };
  const getModel = (a: any) => {
    const asset = getAsset(a);
    const c = norm(a.device_category);
    const fromAssignment =
      c === 'workstation' ? fmt(a.ws_model) : c === 'notebook' ? fmt(a.model_nb) : fmt(a.ws_model || a.model_nb);

    if (fromAssignment !== '-') return fromAssignment;

    const fromAsset = String((asset as any)?.model ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getBrand = (a: any) => {
    const direct = String((a as any)?.brand ?? '').trim();
    if (direct) return direct;
    const asset = getAsset(a);
    const supplier = String((asset as any)?.supplier ?? '').trim();
    if (!supplier) return '-';
    const key = supplier.toLowerCase();
    if (key.includes('hp')) return 'HP';
    if (key.includes('dell')) return 'Dell';
    return supplier;
  };
  const getImmo = (a: any) => {
    const asset = getAsset(a);
    const c = norm(a.device_category);
    const fromAssignment =
      c === 'workstation' ? fmt(a.immo_ws) : c === 'notebook' ? fmt(a.immo_number) : fmt(a.immo_ws || a.immo_number);

    if (fromAssignment !== '-') return fromAssignment;

    const fromAsset = String((asset as any)?.immoNumber ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };
  const getAsset = (a: any) => (a?.assetId ? assets.find((x) => x.id === a.assetId) : undefined);

  const getLastMovement = (movements: StockMovement[], assetId: string, type: StockMovement['type']) => {
    const ms = (movements || [])
      .filter((m) => m.assetId === assetId && m.type === type)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return ms[0];
  };

  const getPrinterArea = (a: any) => {
    const asset = getAsset(a);
    return fmt(a.area || (asset as any)?.area || a.userName);
  };
  const getPrinterDepartment = (a: any) => {
    const asset = getAsset(a);
    return fmt(a.department || (asset as any)?.department);
  };
  const getPrinterCondition = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.condition ?? '').trim() || '-';
  };
  const getPrinterAssetId = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.assetTag ?? '').trim() || '-';
  };
  const getPrinterType = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.type ?? '').trim() || '-';
  };
  const getPrinterModel = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.model ?? '').trim() || '-';
  };
  const getPrinterSn = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.serialNumber ?? '').trim() || '-';
  };
  const getPrinterIp = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.ipAddress ?? '').trim() || '-';
  };
  const getPrinterBarcode = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.barcode ?? '').trim() || '-';
  };
  const getPrinterQr = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.qrCode ?? '').trim() || '-';
  };
  const getPrinterMac = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.macAddress ?? (asset as any)?.mac_address ?? '').trim() || '-';
  };
  const getPrinterStatus = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.status ?? '').trim() || '-';
  };
  const getPrinterDescription = (a: any) => {
    const asset = getAsset(a);
    const desc = String((asset as any)?.description ?? '').trim();
    if (desc) return desc;
    const cat = String((asset as any)?.category ?? '').trim();
    const sup = String((asset as any)?.supplier ?? '').trim();
    const fallback = `${cat}${cat && sup ? ' • ' : ''}${sup}`.trim();
    return fallback || '-';
  };
  const getPrinterBci = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.bci ?? '').trim() || '-';
  };
  const getPrinterBce = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.bce ?? '').trim() || '-';
  };
  const getPrinterBciCheck = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.bciCheck ?? '').trim() || '-';
  };
  const getPrinterVnc = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.vnc ?? '').trim() || '-';
  };
  const getPrinterPlant = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.site ?? '').trim() || '-';
  };
  const getPrinterStore = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.storeLocation ?? '').trim() || '-';
  };
  const getPrinterCabinet = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.cabinet ?? '').trim() || '-';
  };
  const getPrinterRack = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.rack ?? '').trim() || '-';
  };
  const getPrinterLevel = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.level ?? '').trim() || '-';
  };
  const getPrinterStockIn = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.stockIn ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '';
    const lastIn = getLastMovement(stockMovements, id, 'Entry') ?? getLastMovement(stockMovements, id, 'Transfer');
    return lastIn ? '✓' : '';
  };
  const getPrinterDateIn = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.dateIn ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '-';
    const lastIn = getLastMovement(stockMovements, id, 'Entry') ?? getLastMovement(stockMovements, id, 'Transfer');
    return String(lastIn?.date ?? '').trim() || '-';
  };
  const getPrinterPilote = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.pilote ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '-';
    const lastIn = getLastMovement(stockMovements, id, 'Entry') ?? getLastMovement(stockMovements, id, 'Transfer');
    return String(lastIn?.user ?? '').trim() || '-';
  };
  const getPrinterStockOut = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.stockOut ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '';
    const lastOut = getLastMovement(stockMovements, id, 'Exit');
    return lastOut ? '✓' : '';
  };
  const getPrinterDateOut = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.dateOut ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '-';
    const lastOut = getLastMovement(stockMovements, id, 'Exit');
    return String(lastOut?.date ?? '').trim() || '-';
  };
  const getPrinterImmoNumber = (a: any) => {
    const asset = getAsset(a);
    return String((asset as any)?.immoNumber ?? '').trim() || '-';
  };
  const getPrinterPilote1 = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.pilote1 ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '-';
    const lastOut = getLastMovement(stockMovements, id, 'Exit');
    return String(lastOut?.user ?? '').trim() || '-';
  };
  const getPrinterComment = (a: any) => {
    const asset = getAsset(a);
    const raw = String((asset as any)?.comment ?? '').trim();
    if (raw) return raw;

    const id = String((asset as any)?.id ?? '').trim();
    if (!id) return '-';
    const lastIn = getLastMovement(stockMovements, id, 'Entry') ?? getLastMovement(stockMovements, id, 'Transfer');
    const lastOut = getLastMovement(stockMovements, id, 'Exit');
    return (
      String(lastOut?.comment ?? '').trim() ||
      String(lastIn?.comment ?? '').trim() ||
      '-'
    );
  };

  const getTabCategory = (a: any) => {
    // Prefer the assignment's explicit device_category.
    // Using asset.category first can misclassify (e.g. category="Computer" -> fallback).
    const fromAssignment = norm(a?.device_category);
    if (fromAssignment) {
      if (
        fromAssignment.includes('workstation') ||
        fromAssignment === 'computer' ||
        fromAssignment === 'computer/ws' ||
        fromAssignment === 'ws' ||
        fromAssignment === 'desktop'
      ) {
        return 'Workstation';
      }
      if (fromAssignment.includes('notebook') || fromAssignment.includes('laptop') || fromAssignment === 'nb') return 'Notebook';
      if (fromAssignment.includes('printer')) return 'Printer';
    }

    const asset = getAsset(a);
    const raw = asset?.category ?? (asset as any)?.section ?? '';
    const c = norm(raw);

    if (!c) return 'Printer';
    if (
      c.includes('workstation') ||
      c === 'computer' ||
      c === 'computer/ws' ||
      c === 'ws' ||
      c === 'desktop'
    ) {
      return 'Workstation';
    }
    if (c.includes('notebook') || c.includes('laptop')) return 'Notebook';
    if (c.includes('printer')) return 'Printer';
    return 'Printer';
  };

  const getBci = (a: any) => {
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.bci ?? '').trim();
    if (fromAsset) return fromAsset;

    const c = norm(a.device_category);
    if (c === 'workstation') return fmt(a.bci_ws);
    if (c === 'notebook') return fmt(a.bci);
    return fmt(a.bci_ws || a.bci);
  };

  const getBce = (a: any) => {
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.bce ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };

  const getBciCheck = (a: any) => {
    const asset = getAsset(a);
    const fromAsset = String((asset as any)?.bciCheck ?? '').trim();
    return fromAsset ? fromAsset : '-';
  };
  const getAssignDate = (a: any) => fmt(a.assignment_date || a.startDate);

  const getStatus = (a: any) => {
    const s = String(a?.status ?? '').trim();
    // Workflow: new assignments are Pending by default.
    return s ? s : 'Pending';
  };
  const getStartDate = (a: any) => fmt(a.startDate || a.assignment_date);
  const getReturnDate = (a: any) => fmt(a.returnDate);
  const getApprovedBy = (a: any) => fmt(a.approvedBy);
  const getApprovedAt = (a: any) => fmt(a.approvedAt);
  const getEos = (a: any) => fmt(a.end_of_support_date);
  const getMonitor = (a: any) => {
    const model = String(a.monitor_model || '').trim();
    const sn = String(a.monitor_sn || '').trim();
    if (!model && !sn) return '-';
    if (model && sn) return `${model} / ${sn}`;
    return model || sn;
  };

  useEffect(() => {
    setAssignmentsList(assignments);
  }, [assignments]);

  const categoryTabs = CATEGORY_TABS;

  type ColumnDef = {
    key: string;
    label: string;
    render: (a: any) => React.ReactNode;
    className?: string;
  };

  const doRefresh = async () => {
    try {
      await refreshAll();
    } catch {
      // ignore
    }
  };

  const returnAssignment = async (assignment: any) => {
    if (!canManageAssignments) {
      toast.error('Access denied', { description: 'Your role cannot return assignments' });
      return;
    }
    const status = getStatus(assignment) as AssignmentStatus;
    if (status === 'Returned') return;

    await patchAssignment(String(assignment.id), { status: 'Returned' } as any);
    await doRefresh();
  };

  const approveAssignment = async (assignment: any) => {
    if (!canApproveAssignments) {
      toast.error('Access denied', { description: 'Your role cannot approve assignments' });
      return;
    }
    const status = getStatus(assignment) as AssignmentStatus;
    if (status !== 'Pending') return;

    setApproveTarget(assignment);
    setApprovePassword('');
    setApproveSignatureData('');
    setApproveError('');
    setIsApproveOpen(true);
  };

  const confirmApproveAssignment = async () => {
    if (!approveTarget) return;
    if (!canApproveAssignments) return;

    const email = String(user?.email ?? '').trim();
    if (!email) {
      setApproveError('No user email found. Please login again.');
      return;
    }

    const password = approvePassword;
    if (!password.trim()) {
      setApproveError('Password is required');
      return;
    }

    const signatureData = approveSignatureData;
    if (!signatureData.trim()) {
      setApproveError('Signature is required');
      return;
    }

    try {
      setIsApproving(true);
      setApproveError('');

      await approveAssignmentApi(String(approveTarget.id), { email, password, signatureData });

      await doRefresh();
      closeApproveModal();
    } catch (e: any) {
      setApproveError(String(e?.message ?? 'Network error'));
    } finally {
      setIsApproving(false);
    }
  };

  const changeAssignment = async (assignment: any) => {
    if (!canManageAssignments) {
      toast.error('Access denied', { description: 'Your role cannot change assignments' });
      return;
    }
    const status = getStatus(assignment) as AssignmentStatus;
    if (status !== 'Active') {
      toast.error('Change not available', { description: 'Only Active assignments can be changed' });
      return;
    }

    const ok = window.confirm('Change this assignment? (Return + new request)');
    if (!ok) return;

    try {
      await returnAssignment(assignment);
    } catch (e: any) {
      toast.error('Unable to return assignment', { description: String(e?.message ?? 'Network error') });
      return;
    }

    const deviceCategory = getTabCategory(assignment) as any;
    const today = new Date().toISOString().split('T')[0];

    setModalInitial({
      device_category: deviceCategory,
      assetId: String(assignment?.assetId ?? '').trim() || undefined,
      area: deviceCategory === 'Printer' ? String(assignment?.area ?? '').trim() : undefined,
      assignment_date: today,
    });
    setIsModalOpen(true);
  };

  const tableColumns: ColumnDef[] = useMemo(() => {
    if (activeCategory === 'Workstation') {
      return [
        { key: 'asset', label: 'Asset (from stock)', render: getAssetTag, className: 'text-foreground' },
        { key: 'hostname', label: 'hostname', render: getHostname, className: 'text-foreground' },
        { key: 'brand', label: 'Brand', render: getBrand },
        { key: 'usb_status', label: 'usb_status', render: getUsbStatus },
        { key: 'user', label: 'user', render: getWsUser },
        { key: 'ws_sn', label: 'ws_sn', render: getWsSerial },
        { key: 'ws_model', label: 'ws_model', render: getWsModel },
        { key: 'immo_ws', label: 'immo_ws', render: getWsImmo },
        { key: 'bci_ws', label: 'bci_ws', render: getWsBci },
        { key: 'full_name', label: 'full_name', render: getWsFullName },
        { key: 'service', label: 'service', render: getWsService },
        { key: 'os', label: 'os', render: getWsOs },
        { key: 'acquisition_date', label: 'acquisition_date', render: getWsAcquisitionDate },
        { key: 'assignment_date', label: 'assignment_date', render: getWsAssignmentDate },
        { key: 'end_of_support_date', label: 'end_of_support_date', render: getWsEndOfSupportDate },
        { key: 'monitor_model', label: 'monitor_model', render: getWsMonitorModel },
        { key: 'monitor_sn', label: 'monitor_sn', render: getWsMonitorSn },
        { key: 'monitor_immo', label: 'monitor_immo', render: getWsMonitorImmo },
        { key: 'monitor_bci', label: 'monitor_bci', render: getWsMonitorBci },
        { key: 'status', label: 'Status', render: getStatus, className: 'text-foreground' },
        { key: 'startDate', label: 'Start', render: getStartDate },
        { key: 'returnDate', label: 'Return', render: getReturnDate },
        { key: 'approvedBy', label: 'Approved By', render: getApprovedBy },
        { key: 'approvedAt', label: 'Approved At', render: getApprovedAt },
        {
          key: 'actions',
          label: 'Actions',
          render: (a) => {
            const s = getStatus(a) as AssignmentStatus;
            return (
              <div className="flex items-center gap-2">
                <Link
                  to={`/assignments/${encodeURIComponent(String((a as any)?.id ?? ''))}`}
                  className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-cyan-600 transition-colors"
                >
                  View
                </Link>
                {canApproveAssignments && s === 'Pending' && (
                  <button
                    onClick={() => void approveAssignment(a)}
                    className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Approve
                  </button>
                )}
                {canManageAssignments && s !== 'Returned' && (
                  <button
                    onClick={() => void returnAssignment(a)}
                    className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    Return
                  </button>
                )}
                {canManageAssignments && s === 'Active' && (
                  <button
                    onClick={() => void changeAssignment(a)}
                    className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
            );
          },
        },
      ];
    }

    if (activeCategory === 'Notebook') {
      return [
        { key: 'asset', label: 'Asset (from stock)', render: getAssetTag, className: 'text-foreground' },
        { key: 'hostname', label: 'hostname', render: getHostname, className: 'text-foreground' },
        { key: 'brand', label: 'Brand', render: getBrand },
        { key: 'usb', label: 'usb', render: getUsb },
        { key: 'username', label: 'username', render: getNbUsername },
        { key: 'nb_sn', label: 'nb_sn', render: getNbSerial },
        { key: 'model_nb', label: 'model_nb', render: getNbModel },
        { key: 'mac_address', label: 'mac_address', render: getNbMac },
        { key: 'immo_number', label: 'immo_number', render: getNbImmo },
        { key: 'bci', label: 'bci', render: getNbBci },
        { key: 'full_name', label: 'full_name', render: getNbFullName },
        { key: 'service', label: 'service', render: getNbService },
        { key: 'os', label: 'os', render: getNbOs },
        { key: 'acquisition_date', label: 'acquisition_date', render: getNbAcquisitionDate },
        { key: 'assignment_date', label: 'assignment_date', render: getNbAssignmentDate },
        { key: 'end_of_support_date', label: 'end_of_support_date', render: getNbEndOfSupportDate },
        { key: 'monitor_model', label: 'monitor_model', render: getWsMonitorModel },
        { key: 'monitor_sn', label: 'monitor_sn', render: getWsMonitorSn },
        { key: 'monitor_immo', label: 'monitor_immo', render: getWsMonitorImmo },
        { key: 'monitor_bci', label: 'monitor_bci', render: getWsMonitorBci },
        { key: 'status', label: 'Status', render: getStatus, className: 'text-foreground' },
        { key: 'startDate', label: 'Start', render: getStartDate },
        { key: 'returnDate', label: 'Return', render: getReturnDate },
        { key: 'approvedBy', label: 'Approved By', render: getApprovedBy },
        { key: 'approvedAt', label: 'Approved At', render: getApprovedAt },
        {
          key: 'actions',
          label: 'Actions',
          render: (a) => {
            const s = getStatus(a) as AssignmentStatus;
            return (
              <div className="flex items-center gap-2">
                <Link
                  to={`/assignments/${encodeURIComponent(String((a as any)?.id ?? ''))}`}
                  className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-cyan-600 transition-colors"
                >
                  View
                </Link>
                {canApproveAssignments && s === 'Pending' && (
                  <button
                    onClick={() => void approveAssignment(a)}
                    className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Approve
                  </button>
                )}
                {canManageAssignments && s !== 'Returned' && (
                  <button
                    onClick={() => void returnAssignment(a)}
                    className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    Return
                  </button>
                )}
                {canManageAssignments && s === 'Active' && (
                  <button
                    onClick={() => void changeAssignment(a)}
                    className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
            );
          },
        },
      ];
    }

    // Printer
    return [
      { key: 'type', label: 'Brand', render: getPrinterType },
      { key: 'model', label: 'Model', render: getPrinterModel },
      { key: 'sn', label: 'Serial Number', render: getPrinterSn },
      { key: 'condition', label: 'Status', render: getPrinterCondition },
      { key: 'immoNumber', label: 'Asset', render: getPrinterImmoNumber },
      { key: 'dateIn', label: 'Reception Date', render: getPrinterDateIn },
      { key: 'area', label: 'Area', render: getPrinterArea, className: 'text-foreground' },
      { key: 'pilote', label: 'Responsible', render: getPrinterPilote },
      { key: 'bciCheck', label: 'Check', render: getPrinterBciCheck },
      { key: 'department', label: 'Owner', render: getPrinterDepartment, className: 'text-foreground' },
      { key: 'assetId', label: 'Printer Name', render: getPrinterAssetId, className: 'text-foreground' },
      { key: 'plant', label: 'Site', render: getPrinterPlant },
      { key: 'ipAddress', label: 'IP', render: getPrinterIp },
      { key: 'barcode', label: 'Barcode', render: getPrinterBarcode },
      { key: 'qrCode', label: 'QR Code', render: getPrinterQr },
      { key: 'mac', label: 'MAC', render: getPrinterMac },
      { key: 'systemStatus', label: 'System Status', render: getPrinterStatus },
      { key: 'description', label: 'Description', render: getPrinterDescription },
      { key: 'bci', label: 'BCI', render: getPrinterBci },
      { key: 'bce', label: 'BCE', render: getPrinterBce },
      { key: 'vnc', label: 'VNC', render: getPrinterVnc },
      { key: 'store', label: 'Store', render: getPrinterStore },
      { key: 'cabinet', label: 'Cabinet', render: getPrinterCabinet },
      { key: 'rack', label: 'Rack', render: getPrinterRack },
      { key: 'level', label: 'Level', render: getPrinterLevel },
      { key: 'stockIn', label: 'Stock IN', render: getPrinterStockIn },
      { key: 'stockOut', label: 'Stock OUT', render: getPrinterStockOut },
      { key: 'dateOut', label: 'Date OUT', render: getPrinterDateOut },
      { key: 'pilote1', label: 'Pilote 1', render: getPrinterPilote1 },
      { key: 'comment', label: 'Comment', render: getPrinterComment },
      { key: 'assignment_date', label: 'Assignment Date', render: getAssignDate },
      { key: 'assignmentStatus', label: 'Status', render: getStatus, className: 'text-foreground' },
      { key: 'startDate', label: 'Start', render: getStartDate },
      { key: 'returnDate', label: 'Return', render: getReturnDate },
      { key: 'approvedBy', label: 'Approved By', render: getApprovedBy },
      { key: 'approvedAt', label: 'Approved At', render: getApprovedAt },
      {
        key: 'actions',
        label: 'Actions',
        render: (a) => {
          const s = getStatus(a) as AssignmentStatus;
          return (
            <div className="flex items-center gap-2">
              <Link
                to={`/assignments/${encodeURIComponent(String((a as any)?.id ?? ''))}`}
                className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-cyan-600 transition-colors"
              >
                View
              </Link>
              {canApproveAssignments && s === 'Pending' && (
                <button
                  onClick={() => void approveAssignment(a)}
                  className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Approve
                </button>
              )}
              {canManageAssignments && s !== 'Returned' && (
                <button
                  onClick={() => void returnAssignment(a)}
                  className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors"
                >
                  Return
                </button>
              )}
              {canManageAssignments && s === 'Active' && (
                <button
                  onClick={() => void changeAssignment(a)}
                  className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors"
                >
                  Change
                </button>
              )}
            </div>
          );
        },
      },
    ];
  }, [activeCategory, assets, stockMovements, canApproveAssignments, canManageAssignments]);

  const defaultCategory = useMemo(() => {
    for (const name of CATEGORY_TABS) {
      if (assignmentsList.some((a: any) => getTabCategory(a) === name)) return name;
    }
    return CATEGORY_TABS[0];
  }, [CATEGORY_TABS, assignmentsList, assets]);

  useEffect(() => {
    if (!activeCategory) return;
    if (categoryTabs.includes(activeCategory)) return;
    setActiveCategory(defaultCategory);
  }, [activeCategory, categoryTabs, defaultCategory]);

  useEffect(() => {
    // No "All assignments" view: default to the first non-empty category tab.
    if (activeCategory) return;
    setActiveCategory(defaultCategory);
  }, [activeCategory, defaultCategory]);

  const filteredAssignments = useMemo(() => {
    if (!activeCategory) return assignmentsList;
    return assignmentsList.filter((a: any) => {
      return getTabCategory(a) === activeCategory;
    });
  }, [activeCategory, assignmentsList, assets]);

  const searchedAssignments = useMemo(() => {
    const q = norm(searchText);
    if (!q) return filteredAssignments;

    return filteredAssignments.filter((a: any) => {
      const asset = getAsset(a);
      const haystack = [
        a?.id,
        a?.assetId,
        a?.userName,
        a?.username,
        a?.user,
        a?.full_name,
        a?.service,
        a?.department,
        a?.site,
        a?.device_category,
        a?.status,
        getHostname(a),
        getSerial(a),
        getModel(a),
        getImmo(a),
        getBci(a),
        getBce(a),
        getBciCheck(a),
        getAssetCategory(a),
        asset?.assetTag,
        asset?.serialNumber,
        asset?.model,
        (asset as any)?.type,
        (asset as any)?.area,
        (asset as any)?.department,
        (asset as any)?.condition,
        (asset as any)?.immoNumber,
        (asset as any)?.dateIn,
        (asset as any)?.pilote,
        (asset as any)?.bciCheck,
        asset?.site,
        asset?.category,
      ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .join(' ');

      return haystack.toLowerCase().includes(q);
    });
  }, [filteredAssignments, searchText, assets]);

  const handleClearAll = async () => {
    if (!canManageAssignments) {
      toast.error('Access denied', { description: 'Your role is read-only for assignments' });
      return;
    }
    const ok = window.confirm('Delete all assignments?');
    if (!ok) return;
    try {
      const res = await clearAssignments();
      setAssignmentsList([]);
      toast.success('Assignments cleared', { description: `${res.deleted} deleted` });
    } catch (e: any) {
      toast.error('Unable to clear assignments', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddAssignment = async (newAssignment: any) => {
    if (!canManageAssignments) {
      toast.error('Access denied', { description: 'Your role is read-only for assignments' });
      return;
    }
    try {
      const created = await addAssignment(newAssignment);

      const deviceId = (created.hostname || created.ws_sn || created.nb_sn || created.immo_ws || created.immo_number || '').toString().trim();
      const asset = created.assetId ? assets.find(a => a.id === created.assetId) : undefined;
      const assetTag = asset?.assetTag || (created.assetId ?? '') || deviceId || 'Device';

      toast.success('Assignment created', {
        description: `${assetTag} assigned to ${(created.area || created.userName || 'Unknown')}`
      });

      addNotification({
        type: 'success',
        title: 'New assignment',
        message: `${assetTag} assigned to ${(created.area || created.userName || 'Unknown')} (${created.department})`,
        action: { label: 'View assignments', link: '/assignments' }
      });
    } catch (e: any) {
      toast.error('Unable to create assignment', { description: String(e?.message ?? 'Network error') });
    }
  };

  return (
    <motion.div
      className="space-y-6"
      variants={shouldReduceMotion ? undefined : pageContainerVariants}
      initial={shouldReduceMotion ? undefined : 'hidden'}
      animate={shouldReduceMotion ? undefined : 'show'}
    >
      {/* Header */}
      <motion.div className="page-hero" variants={shouldReduceMotion ? undefined : pageItemVariants}>
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Plus className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Assignments</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Assignments
                    </span>
                    <span className="page-hero__title-text">Assignments</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Manage asset assignments to users</p>
              </div>
            </div>
          </div>

          {canManageAssignments && (
            <div className="page-hero__actions">
              <motion.button
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -1 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl bg-muted/50 border border-border text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-colors shadow-sm"
              >
                Remove all
              </motion.button>
              <motion.button
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                onClick={() => setIsModalOpen(true)}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                New assignment
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={shouldReduceMotion ? undefined : pageItemVariants}>
        <motion.div 
          className="premium-surface rounded-3xl p-6 transition-all duration-200 hover:shadow-md" 
          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Active</p>
              <p className="text-2xl font-black text-foreground tabular-nums">
                {searchedAssignments.filter(a => (a.status ?? 'Pending') === 'Active').length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="premium-surface rounded-3xl p-6 transition-all duration-200 hover:shadow-md" 
          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center border border-border">
              <XCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Returned</p>
              <p className="text-2xl font-black text-foreground tabular-nums">
                {searchedAssignments.filter(a => (a.status ?? 'Pending') === 'Returned').length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="premium-surface rounded-3xl p-6 transition-all duration-200 hover:shadow-md" 
          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <CheckCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Pending</p>
              <p className="text-2xl font-black text-foreground tabular-nums">
                {searchedAssignments.filter(a => (a.status ?? 'Pending') === 'Pending').length}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Category Tabs */}
      <motion.div
        className="premium-surface rounded-2xl p-1.5 flex flex-wrap gap-1"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        {categoryTabs.map((name) => {
          const isActive = activeCategory === name;
          return (
            <button
              key={name}
              onClick={() => setActiveCategory(name)}
              className={cn(
                "relative px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
                isActive 
                  ? "text-primary shadow-sm" 
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{name}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Table */}
      <motion.div
        className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
      >
        <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Assignment List</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative group w-full md:w-64">
              <div className="absolute inset-0 bg-primary/5 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search..."
                className="relative w-full h-10 px-4 rounded-xl border border-border/80 bg-card text-foreground placeholder:text-muted-foreground/30 text-[13px] font-medium outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5 shadow-sm"
              />
            </div>
            <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {searchedAssignments.length} Records
            </div>
          </div>
        </div>
        
        <div className="table-scrollbar sidebar-scroll">
          <table className="w-full min-w-max premium-table">
            <thead>
              <tr>
                {tableColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {searchedAssignments.map((assignment: any) => (
                <tr key={assignment.id} className="group transition-all duration-300">
                  {tableColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-8 py-5 whitespace-nowrap text-[13px] font-bold ${col.className ?? 'text-foreground/70'}`}
                    >
                      {col.render(assignment)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal */}
      <AddAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddAssignment}
        assets={assets}
        users={users}
        departments={departments}
        sites={sites}
        initial={modalInitial}
      />

      <Dialog
        open={isApproveOpen}
        onOpenChange={(open) => {
          if (open) setIsApproveOpen(true);
          else if (!isApproving) closeApproveModal();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmApproveAssignment();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Approve assignment</DialogTitle>
              <DialogDescription>Enter your password and upload your signature to approve.</DialogDescription>
            </DialogHeader>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <input
                value={approvePassword}
                onChange={(e) => {
                  setApprovePassword(e.target.value);
                  if (approveError) setApproveError('');
                }}
                type="password"
                placeholder="Password"
                className={`w-full h-10 px-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent ${
                  approveError ? 'border-destructive' : 'border-border'
                }`}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Signature</label>
              <input
                ref={approveSignatureInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void handleApproveSignatureFile(file);
                  e.target.value = '';
                }}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => approveSignatureInputRef.current?.click()}
                  disabled={isApproving}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted/30 disabled:opacity-60"
                >
                  Upload signature
                </button>

                {approveSignatureData ? (
                  <div className="h-12 w-48 border border-border rounded bg-background overflow-hidden flex items-center justify-center">
                    <img src={approveSignatureData} alt="Signature" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-12 w-48 border border-border rounded bg-muted/20 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">No signature</span>
                  </div>
                )}
              </div>

              {approveError && <p className="mt-2 text-sm text-destructive">{approveError}</p>}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={closeApproveModal}
                disabled={isApproving}
                className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted/30 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isApproving || !approvePassword.trim() || !approveSignatureData.trim()}
                className="px-4 py-2 rounded-lg bg-[#1F3C88] text-white hover:bg-[#163069] disabled:opacity-60"
              >
                Approve
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}