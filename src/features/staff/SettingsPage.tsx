import { useEffect, useState } from 'react'
import {
  getSetting, setSetting, getBusinessName,
  getInactivityTimeoutSeconds, setInactivityTimeoutSeconds, MIN_INACTIVITY_TIMEOUT_SECONDS,
} from '../../lib/settings'
import { useToast } from '../../components/ui/Toast'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { getIsCloudConfigured } from '../../lib/supabase'
import { checkLicense, type ActivationCert } from '../../lib/license'
import { Badge } from '../../components/ui/Badge'

export function SettingsPage() {
  const { show } = useToast()
  const cloudConfigured = getIsCloudConfigured()
  const [cert, setCert] = useState<ActivationCert | null>(null)

  useEffect(() => {
    checkLicense().then((state) => setCert(state.status === 'activated' ? state.cert : null))
  }, [])

  const [shopName, setShopName] = useState(() => getBusinessName())
  const [shopAddress, setShopAddress] = useState(() => getSetting('shopAddress'))
  const [footer, setFooter] = useState(() => getSetting('receiptFooter', 'Thank you for shopping with us!'))
  const [adminTimeout, setAdminTimeout] = useState(() => getInactivityTimeoutSeconds('admin'))
  const [staffTimeout, setStaffTimeout] = useState(() => getInactivityTimeoutSeconds('staff'))

  function saveGeneral() {
    setSetting('shopName', shopName)
    setSetting('shopAddress', shopAddress)
    setSetting('receiptFooter', footer)
    show('Settings saved')
  }

  function saveTimeouts() {
    const admin = Math.max(MIN_INACTIVITY_TIMEOUT_SECONDS, adminTimeout)
    const staff = Math.max(MIN_INACTIVITY_TIMEOUT_SECONDS, staffTimeout)
    setInactivityTimeoutSeconds('admin', admin)
    setInactivityTimeoutSeconds('staff', staff)
    setAdminTimeout(admin)
    setStaffTimeout(staff)
    show('Auto sign-out settings saved')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Settings</h1>

      {cert && (
        <Card>
          <CardHeader><CardTitle>License</CardTitle></CardHeader>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">Licensed to <span className="font-medium">{cert.businessName}</span></p>
              <p className="text-xs text-ink-muted">Activated {new Date(cert.issuedAt).toLocaleDateString()}</p>
            </div>
            <Badge tone="gold">Active</Badge>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Cloud Sync</CardTitle></CardHeader>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-ink-secondary">
            {cloudConfigured
              ? 'Connected — data syncs to your Supabase project automatically.'
              : 'Running fully offline against local storage. No cloud backend is connected.'}
          </p>
          <Badge tone={cloudConfigured ? 'gold' : 'coral'}>{cloudConfigured ? 'Connected' : 'Offline-only'}</Badge>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shop Details</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label>Shop Name</Label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Receipts</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label>Receipt Footer Message</Label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
          </div>
          <Button onClick={saveGeneral}>Save Settings</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Auto Sign-Out</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-ink-muted">
            Signs a user out automatically after this many seconds of no activity — a screen left
            unattended at the till won't stay logged in. An interrupted sale is resumed automatically
            on the next login. Minimum {MIN_INACTIVITY_TIMEOUT_SECONDS} seconds.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Admin Timeout (seconds)</Label>
              <Input type="number" min={MIN_INACTIVITY_TIMEOUT_SECONDS} value={adminTimeout} onChange={(e) => setAdminTimeout(Number(e.target.value))} />
            </div>
            <div>
              <Label>Staff Timeout (seconds)</Label>
              <Input type="number" min={MIN_INACTIVITY_TIMEOUT_SECONDS} value={staffTimeout} onChange={(e) => setStaffTimeout(Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={saveTimeouts}>Save Timeout Settings</Button>
        </CardBody>
      </Card>

      <p className="pt-2 text-center text-xs text-ink-muted">
        POS by <span className="font-medium">REACH Digital Experts</span>
      </p>
    </div>
  )
}
