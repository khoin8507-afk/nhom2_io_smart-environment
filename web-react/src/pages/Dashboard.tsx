import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, ButtonGroup, Card, Chip, CircularProgress, Grid, Paper, Snackbar, Stack, Typography } from '@mui/material'
import { AutoMode, CloudDone, DeviceThermostat, Lightbulb, NotificationsActive, Power, Sensors, WaterDrop, WbSunny, Wifi } from '@mui/icons-material'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Device {
  deviceId: string
  name: string
  status: string
  ledState: boolean
  ledAutoMode: boolean
  buzzerState: boolean
  relayState: boolean
}

interface Telemetry {
  id: string
  temperature: number
  humidity: number
  illuminance: number
  recordedAt: string
}

const DEVICE_ID = 'esp32-002'

function SensorCard({ title, value, unit, icon, color, caption }: {
  title: string
  value?: number
  unit: string
  icon: React.ReactNode
  color: string
  caption: string
}) {
  return (
    <Card sx={{ p: 2.5, height: '100%', borderRadius: 4, color: '#fff', background: color }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography sx={{ opacity: 0.85 }}>{title}</Typography>
          <Typography variant="h3" fontWeight={800} mt={0.5}>
            {value ?? '--'}<Typography component="span" variant="h6"> {unit}</Typography>
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>{caption}</Typography>
        </Box>
        <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'rgba(255,255,255,.18)', display: 'flex' }}>{icon}</Box>
      </Stack>
    </Card>
  )
}

function ActuatorCard({ title, subtitle, active, icon, children }: {
  title: string
  subtitle: string
  active: boolean
  icon: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, borderColor: active ? '#22c55e' : '#dbe4ee', bgcolor: active ? '#f0fdf4' : '#f8fafc' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: active ? '#16a34a' : '#64748b', display: 'flex' }}>{icon}</Box>
          <Box>
            <Typography fontWeight={800}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          </Box>
        </Stack>
        <Chip size="small" color={active ? 'success' : 'default'} label={active ? 'ĐANG BẬT' : 'ĐANG TẮT'} />
      </Stack>
      {children}
    </Paper>
  )
}

export default function Dashboard() {
  const { role } = useAuth()
  const [device, setDevice] = useState<Device | null>(null)
  const [history, setHistory] = useState<Telemetry[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const canControl = role !== 'VIEWER'

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const [deviceRes, telemetryRes] = await Promise.all([
        api.get(`/devices/${DEVICE_ID}`),
        api.get(`/devices/${DEVICE_ID}/telemetry?size=30`),
      ])
      setDevice(deviceRes.data)
      setHistory([...telemetryRes.data.content].reverse())
    } catch {
      setMessage({ text: 'Không thể kết nối tới backend.', error: true })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(true)
    const timer = window.setInterval(() => loadData(), 5000)
    return () => window.clearInterval(timer)
  }, [loadData])

  const sendCommand = async (action: string) => {
    if (!device || pendingAction) return
    setPendingAction(action)
    try {
      await api.post(`/devices/${device.deviceId}/commands`, { action })
      setMessage({ text: 'Đã gửi lệnh tới ESP32 qua MQTT.', error: false })
      window.setTimeout(() => loadData(), 800)
    } catch {
      setMessage({ text: 'Gửi lệnh thất bại. Hãy kiểm tra backend và MQTT.', error: true })
    } finally {
      setPendingAction(null)
    }
  }

  const latest = history.length > 0 ? history[history.length - 1] : undefined
  const chartData = useMemo(() => history.map((item) => ({
    time: format(new Date(item.recordedAt), 'HH:mm:ss'),
    temperature: item.temperature,
    humidity: item.humidity,
    light: item.illuminance,
  })), [history])

  if (loading && !device) {
    return <Box display="grid" minHeight="60vh" sx={{ placeItems: 'center' }}><CircularProgress /></Box>
  }
  if (!device) return <Alert severity="error">Không tìm thấy thiết bị {DEVICE_ID}.</Alert>

  const dark = latest?.illuminance === 0
  const temperatureHigh = (latest?.temperature ?? 0) > 30

  return (
    <Box>
      <Paper sx={{ p: { xs: 2.5, md: 4 }, mb: 3, borderRadius: 5, color: '#fff', background: 'linear-gradient(120deg, #0f172a 0%, #0f4c81 55%, #0891b2 100%)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.8 }}>SMART ENVIRONMENT</Typography>
            <Typography variant="h3" fontWeight={850}>Giám sát môi trường</Typography>
            <Typography sx={{ opacity: 0.8, mt: 1 }}>{device.name} · {device.deviceId}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Chip icon={<Wifi />} label={device.status} color={device.status === 'ONLINE' ? 'success' : 'default'} />
            <Chip icon={<CloudDone />} label="MQTT" sx={{ bgcolor: 'rgba(255,255,255,.16)', color: '#fff' }} />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} md={4}>
          <SensorCard title="Nhiệt độ" value={latest?.temperature} unit="°C" icon={<DeviceThermostat />} color="linear-gradient(135deg,#ef4444,#f97316)" caption={temperatureHigh ? 'Trên 30°C · relay đang làm mát' : 'Ngưỡng bật relay: trên 30°C'} />
        </Grid>
        <Grid item xs={12} md={4}>
          <SensorCard title="Độ ẩm không khí" value={latest?.humidity} unit="%" icon={<WaterDrop />} color="linear-gradient(135deg,#0284c7,#38bdf8)" caption="Dữ liệu từ DHT22 · GPIO 3" />
        </Grid>
        <Grid item xs={12} md={4}>
          <SensorCard title="Ánh sáng" value={latest?.illuminance} unit="lux" icon={<WbSunny />} color="linear-gradient(135deg,#ca8a04,#facc15)" caption={dark ? 'Đang tối · tự động bật đèn' : 'Đang có ánh sáng'} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7.5}>
          <Paper sx={{ p: 3, height: 420, borderRadius: 4 }}>
            <Typography variant="h6" fontWeight={800}>Dữ liệu thời gian thực</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Cập nhật mỗi 5 giây qua MQTT</Typography>
            <ResponsiveContainer width="100%" height="82%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Legend />
                <Line type="monotone" dataKey="temperature" name="Nhiệt độ (°C)" stroke="#ef4444" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="humidity" name="Độ ẩm (%)" stroke="#0284c7" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="light" name="Ánh sáng (lux)" stroke="#eab308" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4.5}>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={2.5}>
              <Sensors color="primary" />
              <Box>
                <Typography variant="h6" fontWeight={800}>Điều khiển thiết bị</Typography>
                <Typography variant="body2" color="text.secondary">Backend → MQTT → ESP32</Typography>
              </Box>
            </Stack>
            <Stack spacing={2}>
              <ActuatorCard title="Đèn chiếu sáng" subtitle={device.ledAutoMode ? 'Tự động theo ánh sáng' : 'Điều khiển tay'} active={device.ledState} icon={<Lightbulb />}>
                {canControl ? (
                  <ButtonGroup fullWidth size="small" disabled={Boolean(pendingAction)}>
                    <Button variant={!device.ledAutoMode && device.ledState ? 'contained' : 'outlined'} onClick={() => sendCommand('LED_ON')}>Bật</Button>
                    <Button variant={!device.ledAutoMode && !device.ledState ? 'contained' : 'outlined'} onClick={() => sendCommand('LED_OFF')}>Tắt</Button>
                    <Button startIcon={<AutoMode />} variant={device.ledAutoMode ? 'contained' : 'outlined'} onClick={() => sendCommand('LED_AUTO')}>Tự động</Button>
                  </ButtonGroup>
                ) : <Typography variant="body2">Tài khoản chỉ có quyền xem.</Typography>}
              </ActuatorCard>

              <ActuatorCard title="Còi cảnh báo" subtitle="Buzzer · GPIO 7" active={device.buzzerState} icon={<NotificationsActive />}>
                {canControl ? (
                  <ButtonGroup fullWidth size="small" disabled={Boolean(pendingAction)}>
                    <Button variant={device.buzzerState ? 'contained' : 'outlined'} color="warning" onClick={() => sendCommand('BUZZER_ON')}>Bật còi</Button>
                    <Button variant={!device.buzzerState ? 'contained' : 'outlined'} onClick={() => sendCommand('BUZZER_OFF')}>Tắt còi</Button>
                  </ButtonGroup>
                ) : <Typography variant="body2">Tài khoản chỉ có quyền xem.</Typography>}
              </ActuatorCard>

              <ActuatorCard title="Relay làm mát" subtitle="GPIO 16 · active-low · tự động trên 30°C" active={device.relayState} icon={<Power />}>
                <Alert severity={temperatureHigh ? 'warning' : 'info'} sx={{ py: 0 }}>Firmware tự điều khiển, không bật/tắt thủ công.</Alert>
              </ActuatorCard>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={Boolean(message)} autoHideDuration={3500} onClose={() => setMessage(null)}>
        <Alert severity={message?.error ? 'error' : 'success'} onClose={() => setMessage(null)}>{message?.text}</Alert>
      </Snackbar>
    </Box>
  )
}
