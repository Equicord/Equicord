import { FluxStore, User } from "..";
import { PremiumType } from "../../enums";

export interface OverridePremiumTypeState {
    createdAtOverride: Date | undefined;
    premiumTypeActual: PremiumType | null;
    premiumTypeOverride: PremiumType | undefined;
    perksActual: Record<string, unknown> | null;
}

export class OverridePremiumTypeStore extends FluxStore {
    getState(): OverridePremiumTypeState;
    getCreatedAtOverride(): Date | undefined;
    getPremiumTypeActual(): PremiumType | null;
    getPremiumTypeOverride(): PremiumType | undefined;
    hasPremiumTypeOverride(user: User | null | undefined): boolean;
    getPerksActual(): Record<string, unknown> | null;
    get premiumType(): PremiumType | undefined;
}
