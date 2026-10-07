import { useEffect, useState } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material'
import { format } from 'date-fns'
import api from '../services/api'

interface Telemetry {
  id: string
  temperature: number
  humidity: number
  illuminance: number
  ledState: boolean
  buzzerState: boolean
  relayState: boolean
  recordedAt: string
}

export default function Logs() {
  const [logs, setLogs] = useState<Telemetry[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const rowsPerPage = 10

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get(`/devices/esp32-002/telemetry?page=${page}&size=${rowsPerPage}`)
        setLogs(response.data.content)
        setTotal(response.data.totalElements)
      } catch (error) {
        console.error(error)
      }
    }
    fetchLogs()
    const interval = window.setInterval(fetchLogs, 10000)
    return () => window.clearInterval(interval)
  }, [page])

  return (
    <Box>
      <Typography variant="h4" mb={3} fontWeight="bold">Lịch sử cảm biến</Typography>
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader aria-label="Lịch sử cảm biến">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Thời gian</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Nhiệt độ (°C)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Độ ẩm (%)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Ánh sáng (lux)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Đèn</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Còi</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">Relay</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((row) => (
                <TableRow hover key={row.id}>
                  <TableCell>{format(new Date(row.recordedAt), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                  <TableCell align="right">{row.temperature}</TableCell>
                  <TableCell align="right">{row.humidity}</TableCell>
                  <TableCell align="right">{row.illuminance ?? '--'}</TableCell>
                  <TableCell align="center">{row.ledState ? 'Bật' : 'Tắt'}</TableCell>
                  <TableCell align="center">{row.buzzerState ? 'Bật' : 'Tắt'}</TableCell>
                  <TableCell align="center">{row.relayState ? 'Bật' : 'Tắt'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
        />
      </Paper>
    </Box>
  )
}
