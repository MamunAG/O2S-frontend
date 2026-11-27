"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { ModulePageHeader } from "@/components/module-page-header"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { ActiveFactorySection } from "./component/active-factory-section"
import { DeletedFactorySection, type DeletedFactoryActionMode } from "./component/deleted-factory-section"
import { FactoryFormDialog } from "./component/factory-form-dialog"
import {
    createFactory,
    fetchFactories,
    fetchFactory,
    permanentlyDeleteFactory,
    restoreFactory,
    softDeleteFactory,
    updateFactory,
    uploadFactoryImageFile,
} from "./factory.service"
import {
    EMPTY_FILTERS,
    EMPTY_FORM_VALUES,
    type FactoryFilterValues,
    type FactoryFormValues,
    type FactoryRecord,
    type PaginationMeta,
} from "./factory.types"

type FactoryEditorMode = "create" | "edit"

const CARD_CLASS =
    "overflow-hidden border-white/60 bg-white/85 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75"

function getFactoryLabel(factory: FactoryRecord) {
    return factory.displayName?.trim() || factory.name
}

function getFactoryImagePreviewUrl(factory: FactoryRecord) {
    return (
        factory.image?.public_url?.trim() ||
        factory.image?.file_url?.trim() ||
        factory.image?.thumbnail_url?.trim() ||
        factory.image?.file_path?.trim() ||
        ""
    )
}

function isAuthFailure(message: string) {
    const lower = message.toLowerCase()
    return lower.includes("session expired") || lower.includes("unauthorized")
}

function errorMessage(caught: unknown, fallback: string) {
    return caught instanceof Error ? caught.message : fallback
}

function EmptyState({
    title,
    description,
    actionLabel,
    onAction,
}: {
    title: string
    description: string
    actionLabel: string
    onAction: () => void
}) {
    return (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Plus className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
            <Button type="button" onClick={onAction} className="mt-6 rounded-xl">
                {actionLabel}
            </Button>
        </div>
    )
}

function DeleteConfirmDialog({
    open,
    factory,
    working,
    onOpenChange,
    onConfirm,
}: {
    open: boolean
    factory: FactoryRecord | null
    working: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete factory</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will soft delete{" "}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                            {factory ? getFactoryLabel(factory) : "this factory"}
                        </span>
                        . You can restore it from the recently deleted card before removing it permanently.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={working}>
                        {working ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

function RecentlyDeletedDialog({
    open,
    action,
    factory,
    working,
    onOpenChange,
    onConfirm,
}: {
    open: boolean
    action: DeletedFactoryActionMode
    factory: FactoryRecord | null
    working: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
}) {
    const title = action === "restore" ? "Restore factory" : "Delete factory permanently"
    const description =
        action === "restore"
            ? "Bring this factory back into the active configuration list."
            : "This will permanently remove the factory record and cannot be undone."

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}{" "}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                            {factory ? getFactoryLabel(factory) : "this factory"}
                        </span>
                        .
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant={action === "restore" ? "default" : "destructive"} onClick={onConfirm} disabled={working}>
                        {working ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {action === "restore" ? "Restore" : "Delete permanently"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

function WorkspaceSkeleton() {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ScrollArea className="h-full">
                <div className="space-y-4 p-2 sm:p-3 lg:p-4">
                    <Card className={CARD_CLASS}>
                        <CardContent className="px-3 py-2 sm:px-4">
                            <div className="space-y-2">
                                <div className="h-6 w-56 rounded-full bg-slate-200 dark:bg-slate-800" />
                                <div className="h-4 w-full max-w-md rounded-full bg-slate-200 dark:bg-slate-800" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={CARD_CLASS}>
                        <CardContent className="p-6">
                            <div className="space-y-3">
                                <div className="h-5 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                                    <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                                    <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                                </div>
                                <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-900" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={CARD_CLASS}>
                        <CardContent className="p-6">
                            <div className="space-y-3">
                                <div className="h-5 w-44 rounded-full bg-slate-200 dark:bg-slate-800" />
                                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-900" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
        </div>
    )
}

export function FactoryWorkspace({ apiUrl }: { apiUrl: string }) {
    const router = useRouter()

    const [refreshVersion, setRefreshVersion] = useState(0)
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(() =>
        typeof window === "undefined" ? "" : readSelectedOrganizationId(),
    )

    const [factories, setFactories] = useState<FactoryRecord[]>([])
    const [meta, setMeta] = useState<PaginationMeta | null>(null)
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [activeFilters, setActiveFilters] = useState<FactoryFilterValues>(EMPTY_FILTERS)

    const [deletedFactories, setDeletedFactories] = useState<FactoryRecord[]>([])
    const [deletedMeta, setDeletedMeta] = useState<PaginationMeta | null>(null)
    const [deletedPage, setDeletedPage] = useState(1)
    const [deletedLimit, setDeletedLimit] = useState(5)
    const [deletedFilters, setDeletedFilters] = useState<FactoryFilterValues>(EMPTY_FILTERS)

    const [editorOpen, setEditorOpen] = useState(false)
    const [editorMode, setEditorMode] = useState<FactoryEditorMode>("create")
    const [editorLoading, setEditorLoading] = useState(false)
    const [editorSubmitting, setEditorSubmitting] = useState(false)
    const [editorError, setEditorError] = useState("")
    const [editorValues, setEditorValues] = useState<FactoryFormValues>(EMPTY_FORM_VALUES)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState("")
    const [imageUploading, setImageUploading] = useState(false)

    const [deleteTarget, setDeleteTarget] = useState<FactoryRecord | null>(null)
    const [deleteWorking, setDeleteWorking] = useState(false)
    const [recentlyDeletedFactory, setRecentlyDeletedFactory] = useState<FactoryRecord | null>(null)
    const [pendingActionTarget, setPendingActionTarget] = useState<FactoryRecord | null>(null)
    const [pendingActionMode, setPendingActionMode] = useState<DeletedFactoryActionMode | null>(null)
    const [pendingActionWorking, setPendingActionWorking] = useState(false)

    const organizationId = selectedOrganizationId || undefined

    // Everything the two lists depend on. `loaded` records which request last finished, so "loading" and
    // "error" are derived instead of set inside the effect (react-hooks/set-state-in-effect).
    const requestKey = JSON.stringify([
        page, limit, activeFilters, deletedPage, deletedLimit, deletedFilters, organizationId, refreshVersion,
    ])
    const [loaded, setLoaded] = useState<{ key: string; error: string } | null>(null)
    const loading = loaded?.key !== requestKey
    const error = !loading && loaded ? loaded.error : ""

    const handleAuthFailure = useCallback(
        (message: string) => {
            if (!isAuthFailure(message)) return false

            window.localStorage.removeItem("access_token")
            window.localStorage.removeItem("refresh_token")
            window.localStorage.removeItem("auth_user")
            router.replace("/sign-in")
            return true
        },
        [router],
    )

    /** The stored token, or null after sending the user to sign in. */
    const readToken = useCallback(() => {
        const token = window.localStorage.getItem("access_token")
        if (!token) handleAuthFailure("Your session expired. Please sign in again.")
        return token
    }, [handleAuthFailure])

    useEffect(() => {
        function handleOrganizationChange(event: Event) {
            const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
            setSelectedOrganizationId(next || "")
        }

        window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
        return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    }, [])

    const triggerRefresh = useCallback(() => setRefreshVersion((current) => current + 1), [])

    // Loads the active and the deleted page together; a newer request cancels the older one's result.
    useEffect(() => {
        const token = readToken()
        if (!token) return

        let cancelled = false

        Promise.all([
            fetchFactories({ apiUrl, accessToken: token, page, limit, filters: activeFilters, organizationId }),
            fetchFactories({
                apiUrl,
                accessToken: token,
                page: deletedPage,
                limit: deletedLimit,
                filters: deletedFilters,
                deletedOnly: true,
                organizationId,
            }),
        ])
            .then(([active, deleted]) => {
                if (cancelled) return
                setFactories(active.items)
                setMeta(active.meta)
                setDeletedFactories(deleted.items)
                setDeletedMeta(deleted.meta)
                setLoaded({ key: requestKey, error: "" })
            })
            .catch((caught: unknown) => {
                if (cancelled) return
                const message = errorMessage(caught, "Unable to load factory data right now.")
                if (handleAuthFailure(message)) return
                toast.error(message)
                setLoaded({ key: requestKey, error: message })
            })

        return () => {
            cancelled = true
        }
    }, [apiUrl, activeFilters, deletedFilters, deletedLimit, deletedPage, handleAuthFailure, limit, organizationId, page, readToken, requestKey])

    function openCreateDialog() {
        setEditorMode("create")
        setEditorError("")
        setEditingId(null)
        setEditorValues(EMPTY_FORM_VALUES)
        setImagePreviewUrl("")
        setEditorOpen(true)
    }

    const openEditDialog = useCallback(async (id: string) => {
        setEditorMode("edit")
        setEditingId(id)
        setEditorValues(EMPTY_FORM_VALUES)
        setImagePreviewUrl("")
        setEditorOpen(true)
        setEditorLoading(true)
        setEditorError("")

        try {
            const token = readToken()
            if (!token) return

            const rec = await fetchFactory({ apiUrl, accessToken: token, id, organizationId })
            setEditorValues({
                name: rec.name ?? "",
                displayName: rec.displayName ?? "",
                code: rec.code ?? "",
                contact: rec.contact ?? "",
                email: rec.email ?? "",
                imageId: rec.imageId ?? "",
                address: rec.address ?? "",
                remarks: rec.remarks ?? "",
                isActive: rec.isActive !== false,
            })
            setImagePreviewUrl(getFactoryImagePreviewUrl(rec))
        } catch (caught) {
            const message = errorMessage(caught, "Unable to load the selected factory.")
            if (!handleAuthFailure(message)) {
                setEditorError(message)
                toast.error(message)
            }
        } finally {
            setEditorLoading(false)
        }
    }, [apiUrl, handleAuthFailure, organizationId, readToken])

    const submitEditor = useCallback(async (values: FactoryFormValues) => {
        if (!values.name.trim()) {
            setEditorError("Factory name is required.")
            return
        }

        if (!values.displayName.trim()) {
            setEditorError("Factory display name is required.")
            return
        }

        setEditorSubmitting(true)
        setEditorError("")

        try {
            const token = readToken()
            if (!token) return

            if (editorMode === "create") {
                await createFactory({ apiUrl, accessToken: token, payload: values, organizationId })
                toast.success("Factory created successfully.")
            } else if (editingId != null) {
                await updateFactory({ apiUrl, accessToken: token, id: editingId, payload: values, organizationId })
                toast.success("Factory updated successfully.")
            }

            setEditorOpen(false)
            setEditorValues(EMPTY_FORM_VALUES)
            setImagePreviewUrl("")
            setEditingId(null)
            triggerRefresh()
        } catch (caught) {
            const message = errorMessage(caught, "Unable to save the factory right now.")
            if (!handleAuthFailure(message)) {
                setEditorError(message)
                toast.error(message)
            }
        } finally {
            setEditorSubmitting(false)
        }
    }, [apiUrl, editingId, editorMode, handleAuthFailure, organizationId, readToken, triggerRefresh])

    const uploadFactoryImage = useCallback(async (file: File | null | undefined) => {
        if (!file) return

        if (!file.type.startsWith("image/")) {
            toast.error("Please choose an image file.")
            return
        }

        setImageUploading(true)

        try {
            const token = readToken()
            if (!token) return

            const fileRecord = await uploadFactoryImageFile({ apiUrl, accessToken: token, file })
            setEditorValues((current) => ({ ...current, imageId: String(fileRecord.file_id) }))
            setImagePreviewUrl(
                fileRecord.public_url?.trim() || fileRecord.file_url?.trim() || fileRecord.thumbnail_url?.trim() || "",
            )
            toast.success("Factory image uploaded. It will be saved with the factory.")
        } catch (caught) {
            const message = errorMessage(caught, "Unable to upload the factory image right now.")
            if (!handleAuthFailure(message)) toast.error(message)
        } finally {
            setImageUploading(false)
        }
    }, [apiUrl, handleAuthFailure, readToken])

    const confirmSoftDelete = useCallback(async () => {
        if (!deleteTarget || deleteWorking) return
        setDeleteWorking(true)

        try {
            const token = readToken()
            if (!token) return

            await softDeleteFactory({ apiUrl, accessToken: token, id: deleteTarget.id, organizationId })
            setRecentlyDeletedFactory(deleteTarget)
            setDeleteTarget(null)
            toast.success("Factory moved to recently deleted.")
            triggerRefresh()
        } catch (caught) {
            const message = errorMessage(caught, "Unable to delete the factory right now.")
            if (!handleAuthFailure(message)) toast.error(message)
        } finally {
            setDeleteWorking(false)
        }
    }, [apiUrl, deleteTarget, deleteWorking, handleAuthFailure, organizationId, readToken, triggerRefresh])

    function openPendingActionDialog(factory: FactoryRecord, action: DeletedFactoryActionMode) {
        setPendingActionTarget(factory)
        setPendingActionMode(action)
    }

    const confirmPendingAction = useCallback(async () => {
        if (!pendingActionTarget || !pendingActionMode || pendingActionWorking) return
        setPendingActionWorking(true)

        try {
            const token = readToken()
            if (!token) return

            if (pendingActionMode === "restore") {
                await restoreFactory({ apiUrl, accessToken: token, id: pendingActionTarget.id, organizationId })
                toast.success("Factory restored successfully.")
            } else {
                await permanentlyDeleteFactory({ apiUrl, accessToken: token, id: pendingActionTarget.id, organizationId })
                toast.success("Factory deleted permanently.")
            }

            if (recentlyDeletedFactory?.id === pendingActionTarget.id) setRecentlyDeletedFactory(null)
            setPendingActionTarget(null)
            setPendingActionMode(null)
            triggerRefresh()
        } catch (caught) {
            const message = errorMessage(caught, "Unable to complete the delete action right now.")
            if (!handleAuthFailure(message)) toast.error(message)
        } finally {
            setPendingActionWorking(false)
        }
    }, [apiUrl, handleAuthFailure, organizationId, pendingActionMode, pendingActionTarget, pendingActionWorking, readToken, recentlyDeletedFactory, triggerRefresh])

    const activeTotal = meta?.total ?? factories.length
    const deletedTotal = deletedMeta?.total ?? deletedFactories.length
    const activeOnPage = factories.filter((factory) => factory.isActive !== false).length
    // The table section has no header bar: its badges are in the page header.
    const activeFilterCount = Object.values(activeFilters).filter((value) => value.trim()).length

    // Nothing has finished loading yet (also while redirecting to sign-in).
    if (!loaded) {
        return <WorkspaceSkeleton />
    }

    const header = (
        <ModulePageHeader
            eyebrow="App configuration"
            title="Factory Setup"
            description="Create, review, and maintain factory records."
            badges={
                error
                    ? []
                    : [
                          { label: `Total ${activeTotal}`, variant: "secondary" },
                          { label: `Active ${activeOnPage}` },
                          { label: `Deleted ${deletedTotal}` },
                          { label: `Page ${meta?.totalPages ? meta.page : 0} of ${meta?.totalPages ?? 0}` },
                          { label: `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` },
                          ...(recentlyDeletedFactory ? [{ label: "Recently deleted", variant: "destructive" as const }] : []),
                      ]
            }
            onRefresh={triggerRefresh}
            onCreate={error ? undefined : openCreateDialog}
            createLabel="New factory"
        />
    )

    if (error) {
        return (
            <div className="space-y-4 p-2 sm:p-3 lg:p-4">
                {header}
                <EmptyState title="Unable to load factories" description={error} actionLabel="Try again" onAction={triggerRefresh} />
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ScrollArea className="h-full">
                <div className="space-y-4 p-2 sm:p-3 lg:p-4">
                    {header}

                    {recentlyDeletedFactory ? (
                        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
                                            Recently deleted factory
                                        </p>
                                        <p className="text-sm text-amber-900/80 dark:text-amber-100/85">
                                            {getFactoryLabel(recentlyDeletedFactory)} was soft deleted and can still be restored.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-xl border-amber-300 bg-white/70 text-amber-950 hover:bg-white dark:border-amber-400/40 dark:bg-transparent dark:text-amber-50"
                                            onClick={() => openPendingActionDialog(recentlyDeletedFactory, "restore")}
                                        >
                                            <Undo2 className="size-3.5" />
                                            Restore
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            className="rounded-xl"
                                            onClick={() => openPendingActionDialog(recentlyDeletedFactory, "permanent")}
                                        >
                                            <Trash2 className="size-3.5" />
                                            Delete permanently
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    <ActiveFactorySection
                        data={factories}
                        meta={meta}
                        loading={loading}
                        page={page}
                        limit={limit}
                        filters={activeFilters}
                        onFilterChange={(next) => {
                            setActiveFilters(next)
                            setPage(1)
                        }}
                        onPageChange={setPage}
                        onLimitChange={setLimit}
                        onEdit={openEditDialog}
                        onDelete={setDeleteTarget}
                    />

                    <DeletedFactorySection
                        data={deletedFactories}
                        meta={deletedMeta}
                        loading={loading}
                        page={deletedPage}
                        limit={deletedLimit}
                        filters={deletedFilters}
                        onFilterChange={(next) => {
                            setDeletedFilters(next)
                            setDeletedPage(1)
                        }}
                        onPageChange={setDeletedPage}
                        onLimitChange={setDeletedLimit}
                        onOpenAction={openPendingActionDialog}
                    />
                </div>
            </ScrollArea>

            <FactoryFormDialog
                open={editorOpen}
                loading={editorLoading}
                submitting={editorSubmitting}
                error={editorError}
                mode={editorMode}
                values={editorValues}
                onValuesChange={setEditorValues}
                imagePreviewUrl={imagePreviewUrl}
                imageUploading={imageUploading}
                onOpenChange={(open) => {
                    setEditorOpen(open)

                    if (!open) {
                        setEditorValues(EMPTY_FORM_VALUES)
                        setImagePreviewUrl("")
                        setEditorError("")
                        setEditorLoading(false)
                        setEditorSubmitting(false)
                        setEditingId(null)
                    }
                }}
                onImageUpload={uploadFactoryImage}
                onSubmit={submitEditor}
            />

            <DeleteConfirmDialog
                open={Boolean(deleteTarget)}
                factory={deleteTarget}
                working={deleteWorking}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
                onConfirm={confirmSoftDelete}
            />

            <RecentlyDeletedDialog
                open={Boolean(pendingActionTarget && pendingActionMode)}
                action={pendingActionMode ?? "restore"}
                factory={pendingActionTarget}
                working={pendingActionWorking}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingActionTarget(null)
                        setPendingActionMode(null)
                    }
                }}
                onConfirm={confirmPendingAction}
            />
        </div>
    )
}
