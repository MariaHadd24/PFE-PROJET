import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, Calendar, DollarSign, MapPin, Package, User } from 'lucide-react';
import type { AssetStatus } from '../types';
import { useData } from '../context/DataContext';
import { formatMAD } from '../lib/money';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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

const statusStyles: Record<AssetStatus, string> = {
  Available: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Assigned: 'bg-blue-100 text-blue-700',
  InRepair: 'bg-orange-100 text-orange-700',
  Retired: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-200'
};

const SCANNER_TYPES = ['Cradle', 'Pistolet', 'Barcode Scanner'] as const;
const CISCO_TYPES = ['Switch', 'Router', 'Wireless Controller', 'Access Point'] as const;

function normalizeCiscoType(value: unknown): string {
  const v = String(value ?? '').trim();
  const up = v.toUpperCase();

  // Legacy values we previously used
  if (up === 'SWITCH' || up === 'SWITCHES') return 'Switch';
  if (up === 'ROUTER') return 'Router';
  if (up === 'WIRELESS CONTROLLER') return 'Wireless Controller';
  if (up === 'ACCESS POINT') return 'Access Point';

  // Types we removed
  if (up === 'SERVER' || up === 'SERVERS') return '';

  // Already-correct or other custom value
  return v;
}

function isScannerCategory(category: string) {
  return category === 'Scanner' || category === 'Scanners';
}

function isWorkstationCategory(category: string) {
  return category === 'Workstation';
}

function isNotebookCategory(category: string) {
  return category === 'Notebook';
}

function categoryNeedsType(category: string) {
  return isScannerCategory(category) || category === 'Cisco';
}

export function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assets, categories, sites, suppliers, stockMovements, assignments, maintenanceTickets, updateAsset, removeAsset } =
    useData();
  const [activeTab, setActiveTab] = useState<'info' | 'movements' | 'assignments' | 'maintenance'>('info');
  const [editMode, setEditMode] = useState(false);

  const asset = assets.find(a => a.id === id);
  const assetMovements = stockMovements.filter(m => m.assetId === id);
  const assetAssignments = assignments.filter(a => a.assetId === id);
  const assetTickets = maintenanceTickets.filter(t => t.assetId === id);

  const formatAssignmentDeviceInfo = (a: any): string => {
    const parts: string[] = [];
    if (a.device_category) parts.push(String(a.device_category));

    const add = (label: string, value: any) => {
      if (value === undefined || value === null) return;
      const v = String(value).trim();
      if (!v) return;
      parts.push(`${label}: ${v}`);
    };

    add('hostname', a.hostname);

    // Workstation-specific
    add('usb_status', a.usb_status);
    add('user', a.user);
    add('ws_sn', a.ws_sn);
    add('ws_model', a.ws_model);
    add('immo_ws', a.immo_ws);
    add('bci_ws', a.bci_ws);

    // Notebook-specific
    add('usb', a.usb);
    add('username', a.username);
    add('nb_sn', a.nb_sn);
    add('model_nb', a.model_nb);
    add('mac_address', a.mac_address);
    add('immo_number', a.immo_number);
    add('bci', a.bci);

    // Common-ish
    add('full_name', a.full_name);
    add('service', a.service);
    add('os', a.os);
    add('acquisition_date', a.acquisition_date);
    add('assignment_date', a.assignment_date);
    add('end_of_support_date', a.end_of_support_date);
    add('monitor_model', a.monitor_model);
    add('monitor_sn', a.monitor_sn);
    add('monitor_immo', a.monitor_immo);
    add('monitor_bci', a.monitor_bci);

    return parts.join(' • ');
  };

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Asset not found</p>
      </div>
    );
  }

  const categoryOptions = useMemo(() => {
    const values = [asset.category, ...categories.map((c) => c.name)].filter(Boolean);
    return Array.from(new Set(values));
  }, [asset.category, categories]);
  const siteOptions = useMemo(() => {
    const values = [asset.site, ...sites.map((s) => s.name)].filter(Boolean);
    return Array.from(new Set(values));
  }, [asset.site, sites]);
  const supplierOptions = useMemo(() => {
    const values = [asset.supplier, ...suppliers.map((s) => s.name)].filter(Boolean);
    return Array.from(new Set(values));
  }, [asset.supplier, suppliers]);

  const [form, setForm] = useState(() => ({
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber,
    macAddress: asset.macAddress ?? '',
    model: asset.model,
    category: asset.category,
    type: normalizeCiscoType((asset as any).type ?? ''),
    supplier: asset.supplier,
    site: asset.site,
    status: asset.status,
    acquisitionDate: asset.acquisitionDate,
    warrantyEndDate: asset.warrantyEndDate,
    value: String(asset.value ?? 0),
    deviceProfile: (asset as any).deviceProfile ?? null,
  }));

  useEffect(() => {
    setForm({
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      macAddress: asset.macAddress ?? '',
      model: asset.model,
      category: asset.category,
      type: normalizeCiscoType((asset as any).type ?? ''),
      supplier: asset.supplier,
      site: asset.site,
      status: asset.status,
      acquisitionDate: asset.acquisitionDate,
      warrantyEndDate: asset.warrantyEndDate,
      value: String(asset.value ?? 0),
      deviceProfile: (asset as any).deviceProfile ?? null,
    });
    setEditMode(false);
  }, [asset.id]);

  const onSave = async () => {
    const value = Number(form.value);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Invalid value', { description: 'Value must be a number ≥ 0' });
      return;
    }

    if (categoryNeedsType(form.category) && !String(form.type ?? '').trim()) {
      toast.error('Invalid type', { description: 'Type is required for Scanner / Cisco' });
      return;
    }

    const macAddress = form.macAddress.trim();

    try {
      const payload: any = {
        assetTag: form.assetTag.trim(),
        serialNumber: form.serialNumber.trim(),
        macAddress: macAddress || undefined,
        model: form.model.trim(),
        category: form.category,
        supplier: form.supplier,
        site: form.site,
        status: form.status,
        acquisitionDate: form.acquisitionDate,
        warrantyEndDate: form.warrantyEndDate,
        value,
      };

      if (categoryNeedsType(form.category)) {
        payload.type = String(form.type ?? '').trim();
      } else if (categoryNeedsType(asset.category)) {
        // When switching away from a typed category, clear stored type.
        payload.type = null;
      }

      if (isWorkstationCategory(form.category) || isNotebookCategory(form.category)) {
        payload.deviceProfile = form.deviceProfile ?? null;
      } else if (isWorkstationCategory(asset.category) || isNotebookCategory(asset.category)) {
        payload.deviceProfile = null;
      }

      await updateAsset(asset.id, payload);
      toast.success('Asset updated');
      setEditMode(false);
    } catch (e: any) {
      toast.error('Unable to update asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const onDelete = async () => {
    try {
      await removeAsset(asset.id);
      toast.success('Asset deleted');
      navigate('/stock-inventory');
    } catch (e: any) {
      toast.error('Unable to delete asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const tabs = [
    { id: 'info', label: 'General information' },
    { id: 'movements', label: 'Movement history' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'maintenance', label: 'Maintenance' }
  ] as const;

  const deviceProfileKeys = useMemo(() => {
    if (isWorkstationCategory(form.category)) {
      return [
        'hostname',
        'site',
        'usb_status',
        'user',
        'full_name',
        'service',
        'ws_sn',
        'ws_model',
        'os',
        'immo_ws',
        'bci_ws',
        'acquisition_date',
        'assignment_date',
        'end_of_support_date',
        'monitor_model',
        'monitor_sn',
        'monitor_immo',
        'monitor_bci',
      ];
    }
    if (isNotebookCategory(form.category)) {
      return [
        'hostname',
        'site',
        'usb',
        'username',
        'full_name',
        'service',
        'nb_sn',
        'model_nb',
        'mac_address',
        'os',
        'immo_number',
        'bci',
        'acquisition_date',
        'assignment_date',
        'end_of_support_date',
        'monitor_model',
        'monitor_sn',
        'monitor_immo',
        'monitor_bci',
      ];
    }
    return [] as string[];
  }, [form.category]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/stock-inventory" className="inline-flex items-center gap-2 text-primary hover:opacity-90 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Assets IT
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{asset.assetTag}</h1>
            <p className="text-muted-foreground mt-1">{asset.model}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-lg font-semibold ${statusStyles[asset.status]}`}>
              {asset.status}
            </span>
            {activeTab === 'info' && (
              <>
                {!editMode ? (
                  <Button variant="outline" onClick={() => setEditMode(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      Cancel
                    </Button>
                    <Button onClick={onSave}>Save</Button>
                  </>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete asset?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {asset.assetTag}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="premium-surface p-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Identification</h3>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Asset Tag</label>
                {editMode ? (
                  <Input value={form.assetTag} onChange={(e) => setForm((p) => ({ ...p, assetTag: e.target.value }))} />
                ) : (
                  <p className="text-gray-900 mt-1">{asset.assetTag}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Serial Number</label>
                {editMode ? (
                  <Input
                    value={form.serialNumber}
                    onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))}
                  />
                ) : (
                  <p className="text-gray-900 mt-1">{asset.serialNumber}</p>
                )}
              </div>

              {asset.macAddress && (
                <div>
                  <label className="text-sm font-medium text-gray-600">MAC Address</label>
                  {editMode ? (
                    <Input
                      value={form.macAddress}
                      onChange={(e) => setForm((p) => ({ ...p, macAddress: e.target.value }))}
                    />
                  ) : (
                    <p className="text-gray-900 mt-1">{asset.macAddress}</p>
                  )}
                </div>
              )}

              {editMode && !asset.macAddress && (
                <div>
                  <label className="text-sm font-medium text-gray-600">MAC Address</label>
                  <Input value={form.macAddress} onChange={(e) => setForm((p) => ({ ...p, macAddress: e.target.value }))} />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-600">Model</label>
                {editMode ? (
                  <Input value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} />
                ) : (
                  <p className="text-gray-900 mt-1">{asset.model}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Category</label>
                {editMode ? (
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        category: v,
                        type: '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-gray-900 mt-1">{asset.category}</p>
                )}
              </div>

              {categoryNeedsType(form.category) && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  {editMode ? (
                    <Select value={String(form.type ?? '')} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(isScannerCategory(form.category) ? SCANNER_TYPES : CISCO_TYPES).map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-gray-900 mt-1">{String((asset as any).type ?? '-')}</p>
                  )}
                </div>
              )}

              {(isWorkstationCategory(form.category) || isNotebookCategory(form.category)) && (
                <div className="md:col-span-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Device profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deviceProfileKeys.map((key) => (
                      <div key={key}>
                        <label className="text-sm font-medium text-gray-600">{key}</label>
                        {editMode ? (
                          <Input
                            type={key.endsWith('_date') ? 'date' : 'text'}
                            value={String((form.deviceProfile as any)?.[key] ?? '')}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                deviceProfile: {
                                  kind: isWorkstationCategory(p.category) ? 'Workstation' : 'Notebook',
                                  ...(p.deviceProfile as any),
                                  [key]: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : (
                          <p className="text-gray-900 mt-1">{String(((asset as any).deviceProfile as any)?.[key] ?? '-')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Details</h3>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Supplier</label>
                {editMode ? (
                  <Select value={form.supplier} onValueChange={(v) => setForm((p) => ({ ...p, supplier: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-gray-900 mt-1">{asset.supplier}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Site</label>
                {editMode ? (
                  <Select value={form.site} onValueChange={(v) => setForm((p) => ({ ...p, site: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {siteOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-gray-900 mt-1">{asset.site}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Acquisition date</label>
                {editMode ? (
                  <Input
                    type="date"
                    value={form.acquisitionDate}
                    onChange={(e) => setForm((p) => ({ ...p, acquisitionDate: e.target.value }))}
                  />
                ) : (
                  <p className="text-gray-900 mt-1">{new Date(asset.acquisitionDate).toLocaleDateString('en-US')}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Warranty end date</label>
                {editMode ? (
                  <Input
                    type="date"
                    value={form.warrantyEndDate}
                    onChange={(e) => setForm((p) => ({ ...p, warrantyEndDate: e.target.value }))}
                  />
                ) : (
                  <p className="text-gray-900 mt-1">{new Date(asset.warrantyEndDate).toLocaleDateString('en-US')}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                {editMode ? (
                  <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as AssetStatus }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {(['Available', 'Assigned', 'InRepair', 'Retired'] as AssetStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-gray-900 mt-1">{asset.status}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Valeur</label>
                {editMode ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.value}
                    onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                  />
                ) : (
                  <p className="text-gray-900 mt-1 text-xl font-semibold">{formatMAD(asset.value)}</p>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-gray-200">
                <h4 className="text-base font-bold text-gray-900 mb-3">Assets IT</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    [
                      { label: 'Description', value: asset.description },
                      { label: 'BCI', value: asset.bci },
                      { label: 'BCE', value: asset.bce },
                      { label: 'BCI Check', value: asset.bciCheck },
                      { label: 'VNC', value: asset.vnc },
                      { label: 'Immo Number', value: asset.immoNumber },
                      { label: 'Pilote', value: asset.pilote },
                      { label: 'Pilote 1', value: asset.pilote1 },
                      { label: 'Stock IN', value: asset.stockIn },
                      { label: 'Date IN', value: asset.dateIn },
                      { label: 'Stock OUT', value: asset.stockOut },
                      { label: 'Date OUT', value: asset.dateOut },
                      { label: 'Barcode', value: asset.barcode },
                      { label: 'QR Code', value: asset.qrCode },
                      { label: 'Magasin', value: asset.storeLocation },
                      { label: 'Armoire', value: asset.cabinet },
                      { label: 'Rack', value: asset.rack },
                      { label: 'Étage', value: asset.level },
                      { label: 'Comment', value: asset.comment },
                    ] as Array<{ label: string; value: any }>
                  ).map((f) => (
                    <div key={f.label}>
                      <label className="text-sm font-medium text-gray-600">{f.label}</label>
                      <p className="text-gray-900 mt-1">{String(f.value ?? '').trim() || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'movements' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Movement History</h3>
            {assetMovements.length === 0 ? (
              <p className="text-gray-500">No movements recorded</p>
            ) : (
              <div className="space-y-4">
                {assetMovements.map((movement) => (
                  <div key={movement.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{movement.type}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(movement.date).toLocaleDateString('en-US')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {movement.sourceSite && `From: ${movement.sourceSite}`}
                        {movement.sourceSite && movement.destinationSite && ' → '}
                        {movement.destinationSite && `To: ${movement.destinationSite}`}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{movement.comment}</p>
                      <p className="text-xs text-gray-400 mt-1">By: {movement.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Assignment History</h3>
            {assetAssignments.length === 0 ? (
              <p className="text-gray-500">No assignments recorded</p>
            ) : (
              <div className="space-y-4">
                {assetAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{assignment.userName}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          assignment.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : assignment.status === 'Pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {assignment.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{assignment.department} - {assignment.site}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Start: {new Date(assignment.startDate).toLocaleDateString('en-US')}
                        {assignment.returnDate && ` - Return: ${new Date(assignment.returnDate).toLocaleDateString('en-US')}`}
                      </p>
                      {formatAssignmentDeviceInfo(assignment) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatAssignmentDeviceInfo(assignment)}
                        </p>
                      )}
                      {assignment.approvedBy && (
                        <p className="text-xs text-gray-400 mt-1">Approved by: {assignment.approvedBy}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Maintenance Tickets</h3>
            {assetTickets.length === 0 ? (
              <p className="text-gray-500">No maintenance tickets</p>
            ) : (
              <div className="space-y-4">
                {assetTickets.map((ticket) => (
                  <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900">{ticket.id}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        ticket.status === 'Open' ? 'bg-orange-100 text-orange-700' :
                        ticket.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{ticket.description}</p>
                    {ticket.actions && (
                      <p className="text-sm text-gray-600 mb-2">Actions: {ticket.actions}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Provider: {ticket.provider}</span>
                      <span>Cost: {formatMAD(ticket.cost, { decimals: 2 })}</span>
                      <span>Opened: {new Date(ticket.openDate).toLocaleDateString('en-US')}</span>
                      {ticket.closeDate && (
                        <span>Closed: {new Date(ticket.closeDate).toLocaleDateString('en-US')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
