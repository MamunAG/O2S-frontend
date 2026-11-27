"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/notification.service"
import type { NotificationRecord } from "@/features/notifications/notification.types"

function safePath(link?: string | null) { if (!link) return "/"; try { const url = new URL(link, window.location.origin); return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : "/" } catch { return link.startsWith("/") && !link.startsWith("//") ? link : "/" } }
export function NotificationCenter() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unread, setUnread] = useState(0)
  const load = useCallback(async () => { const apiUrl = process.env.NEXT_PUBLIC_API_URL; const accessToken = localStorage.getItem("access_token"); if (!apiUrl || !accessToken) return; setLoading(true); try { const result = await fetchNotifications({ apiUrl, accessToken, page, limit: 20 }); setItems(result.items); setUnread(result.unreadCount); setTotalPages(result.meta.totalPages) } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load notifications.") } finally { setLoading(false) } }, [page])
  useEffect(() => { const pending = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(pending) }, [load])
  async function open(item: NotificationRecord) { const apiUrl = process.env.NEXT_PUBLIC_API_URL; const accessToken = localStorage.getItem("access_token"); if (!apiUrl || !accessToken) return; try { if (!item.isRead) await markNotificationRead({ apiUrl, accessToken, notificationId: item.id }); router.push(safePath(item.link)) } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to open notification.") } }
  async function markAll() { const apiUrl = process.env.NEXT_PUBLIC_API_URL; const accessToken = localStorage.getItem("access_token"); if (!apiUrl || !accessToken) return; try { await markAllNotificationsRead({ apiUrl, accessToken }); await load() } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update notifications.") } }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2"><Bell className="size-5 shrink-0" />Notification center</CardTitle>
              <CardDescription>Leave approvals, decisions, and other account activity.</CardDescription>
            </div>
            <Button variant="outline" className="self-start" disabled={!unread} onClick={() => void markAll()}>Mark all read</Button>
          </div>
        </CardHeader>
      </Card>
      {loading ? (
        <Card><CardContent className="flex justify-center py-20"><Loader2 className="animate-spin" /></CardContent></Card>
      ) : items.length ? (
        items.map((item) => (
          <button key={item.id} type="button" className="block w-full text-left" onClick={() => void open(item)}>
            <Card className={item.isRead ? "opacity-75" : "ring-primary/30"}>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-semibold">{item.title}</p>
                    {!item.isRead ? <Badge>Unread</Badge> : null}
                    <Badge variant="outline">{item.type.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-2 break-words text-muted-foreground">{item.body}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground sm:text-sm">{new Date(item.created_at).toLocaleString()}</time>
              </CardContent>
            </Card>
          </button>
        ))
      ) : (
        <Card><CardContent className="py-20 text-center text-muted-foreground">You have no notifications.</CardContent></Card>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
        <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
      </div>
    </div>
  )
}
