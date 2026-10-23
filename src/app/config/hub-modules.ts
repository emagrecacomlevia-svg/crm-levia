import { coreModule } from "@/modules/core";
import { crmModule } from "@/modules/crm";
import { socialStudioModule } from "@/modules/social-studio";

export const hubModules = [socialStudioModule, crmModule, coreModule] as const;
