/**
 * Import-only type edges.
 *
 * Each DSH package puts its own service on the Cordis `Context` through its
 * own module augmentation, so this file no longer redeclares them: it only
 * pulls the augmentations into the program for every compilation unit.
 * (`@deepseek-ai/dsh-client-runtime` was retired in DSH 0.2.1.)
 */
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-host-webserver'
