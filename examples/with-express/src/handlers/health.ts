import { Router } from "express"

const router = Router()

/**
 * GET /health - Health check endpoint
 */
router.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

export default router
