type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

export type SetPasswordResult = {
  access_token?: string
  refresh_token?: string
  user?: Record<string, unknown>
  must_change_password?: boolean
}

/** Replaces the current (one-time) password; the answer is a fresh session. */
export async function setNewPassword({
  apiUrl,
  accessToken,
  currentPassword,
  newPassword,
}: {
  apiUrl: string
  accessToken: string
  currentPassword: string
  newPassword: string
}): Promise<SetPasswordResult> {
  const response = await fetch(new URL("/api/v1/auth/change-password", apiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  let payload: ApiResponse<SetPasswordResult> | null = null
  try {
    payload = (await response.json()) as ApiResponse<SetPasswordResult>
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Unable to set the new password right now.")
  }

  return payload.data ?? {}
}
