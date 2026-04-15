/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ProfileBadge } from "@api/Badges";

import { IPBadgeCategory, IPersonalBadge } from "../../../types";
import { DEVELOPER_BADGE_URL, PluginLogger } from "../../../utils/constants";
import * as api from "../../api";
import { defineProfileBadge, iPersonalToProfile } from "..";
import * as BadgeStore from ".";


const cache = new Map<string, IPBadgeCategory>();


let dev: ProfileBadge;

// why not? who says I can't have a global badge for making the plugin lol
function fetchDevBadge() {
    fetch(DEVELOPER_BADGE_URL).then(async function (response) {
        const json: IPersonalBadge = await response?.json();
        if (!json) return;

        if (dev) Vencord.Api.Badges.removeProfileBadge(dev);
        dev = iPersonalToProfile(json);
        Vencord.Api.Badges.addProfileBadge(dev);
    });
}


export const CategoryHandler = (new class {

    public getCache(): Map<string, IPBadgeCategory> { return cache; }

    public async deregister(c_id: string): Promise<boolean> {
        try {
            const category = cache.get(c_id);
            if (!category) return false;

            for (const badge of category.badges ?? [])
                await BadgeStore.BadgeHandler.deregister(c_id, badge.id);

            if (await BadgeStore.deregisterCategory(c_id))
                cache.delete(c_id);
            else return false;

            PluginLogger.info(`(${c_id}) Category "${category.name}" successfully deregistered.`);
            return true;
        } catch (error) {
            PluginLogger.warn(`Could not successfully deregister category. (${c_id})`);
            PluginLogger.error(error);
            return false;
        }
    }

    public async update(value: IPBadgeCategory): Promise<boolean> {
        try {
            if (!cache.get(value.id)) return false;

            if (await BadgeStore.updateCategory(value)) {
                cache.set(value.id, value);
            } else return false;

            PluginLogger.info(`(${value.id}) Category "${value.name}" successfully updated.`);
            return true;
        } catch (error) {
            PluginLogger.warn(`Could not successfully update category. (${value.id})`);
            PluginLogger.error(error);
            return false;
        }
    }

    public async register(value: IPBadgeCategory): Promise<boolean> {
        try {
            if (Array.from(cache.entries()).some((data: [string, IPBadgeCategory]) => {
                // PluginLogger.log(data[1], value);

                if (data[1].name === value.name) return true;
                if (data[1].badges && value.badges)
                    if (data[1].badges.length > 0 && value.badges.length > 0)
                        return JSON.stringify(data[1].badges) === JSON.stringify(value.badges);
            })) return false;

            if (await BadgeStore.registerCategory(value)) {
                for (const badge of value.badges ?? [])
                    badge.profileBadge = iPersonalToProfile(badge);
                cache.set(value.id, value);
            } else return false;

            for (const badge of value.badges ?? []) {
                if (!api.addBadge(value.id, badge.id)) continue;
                PluginLogger.info(`(${value.id}) Badge "${badge.tooltip}" (${badge.id}) successfully registered.`);
            }

            PluginLogger.info(`(${value.id}) Category "${value.name}" successfully registered.`);
            return true;
        } catch (error) {
            PluginLogger.warn(`Could not successfully register category. (${value.id})`);
            PluginLogger.error(error);
            return false;
        }
    }
});

export default (new class BadgeHandler {

    public getCache(): Map<string, IPBadgeCategory> { return cache; }

    public async refreshCache() {
        let count: number = 0;

        try {
            const registered = await BadgeStore.registered();

            Object.entries(registered).map(data => {
                for (const v of data[1].badges ?? []) {
                    v.profileBadge = iPersonalToProfile(v);
                    count++;
                }
                cache.set(data[0], data[1]);
            });

            PluginLogger.info(`(${cache.size}|${count}) Cache successfully refreshed.`);
        } catch (error) {
            PluginLogger.warn(`Could not successfully refresh cache. (${cache.size}|${count})`);
            PluginLogger.error(error);
        }
    }

    public async re_init() {
        this.de_init();
        await this.init();
    }

    public de_init() {
        let count: number = 0;

        try {
            cache.forEach(data => {
                for (const badge of data.badges ?? []) {
                    Vencord.Api.Badges.removeProfileBadge(defineProfileBadge(badge.profileBadge));
                    count++;
                }
            });

            PluginLogger.info(`(${count}) Badge(s) successfully deregistered.`);
            cache.clear();
        } catch (error) {
            PluginLogger.warn(`Could not successfully deregister badge(s). (${count})`);
            PluginLogger.error(error);
        }
    }

    public async init() {
        let count: number = 0;

        try {
            await this.refreshCache();
            cache.forEach(data => {
                for (const badge of data.badges ?? []) {
                    Vencord.Api.Badges.addProfileBadge(defineProfileBadge(badge.profileBadge));
                    count++;
                }
            });

            fetchDevBadge();
            PluginLogger.info(`(${count}) Badge(s) successfully registered.`);
        } catch (error) {
            PluginLogger.warn(`Could not successfully register badge(s). (${count})`);
            PluginLogger.error(error);
        }
    }

    public async deregister(c_id: string, b_id: string): Promise<boolean> {
        try {
            const category = cache.get(c_id);
            if (!category) return false;

            const badge = api.removeBadge(category.id, b_id);
            if (!badge) return false;

            if (await BadgeStore.deregisterBadge(c_id, b_id)) {
                category.badges?.splice(category.badges?.indexOf(badge), 1);
                cache.set(c_id, category);
            } else return false;

            PluginLogger.info(`(${c_id}) Badge "${badge.tooltip}" (${badge.id}) successfully deregistered.`);
            return true;
        } catch (error) {
            PluginLogger.warn(`Could not successfully deregister badge. (${c_id}) (${b_id})`);
            PluginLogger.error(error);
            return false;
        }
    }

    public async update(c_id: string, value: IPersonalBadge): Promise<boolean> {
        try {
            const category = cache.get(c_id);
            if (!category) return false;

            const old = cache.get(value.c_id);
            if (!old) return false;

            let badge = api.removeBadge(c_id !== value.c_id ? old.id : category.id, value.id);
            if (!badge) return false;

            if (c_id !== value.c_id) {
                old.badges?.splice(old.badges?.indexOf(badge), 1);
                cache.set(value.c_id, old);
            } else category.badges?.splice(category.badges?.indexOf(badge), 1);

            if (await BadgeStore.updateBadge(c_id, value)) {
                value.profileBadge = iPersonalToProfile(value);
                category.badges?.push(value);
                cache.set(c_id, category);
            } else return false;

            badge = api.addBadge(category.id, value.id);
            if (!badge) return false;

            PluginLogger.info(`(${c_id}) Badge "${badge.tooltip}" (${badge.id}) successfully updated.`);
            return true;
        } catch (error) {
            PluginLogger.warn(`Could not successfully update badge. (${c_id}) (${value.id})`);
            PluginLogger.error(error);
            return false;
        }
    }

    public async register(c_id: string, value: IPersonalBadge): Promise<boolean> {
        try {
            if (Array.from(cache.entries()).some((data: [string, IPBadgeCategory]) => {
                return data[1].badges?.some(x => {
                    const { id: _, c_id: __, profileBadge: ___, ...cached } = x;
                    const { id: ____, c_id: _____, profileBadge: ______, ...object } = value;
                    // PluginLogger.log(cached, object);
                    return JSON.stringify(cached) === JSON.stringify(object);
                });
            })) return false;

            const category = cache.get(c_id);
            if (!category) return false;

            if (await BadgeStore.registerBadge(c_id, value)) {
                value.profileBadge = iPersonalToProfile(value);
                category.badges?.push(value);
                cache.set(c_id, category);
            } else return false;

            const badge = api.addBadge(category.id, value.id);
            if (!badge) return false;

            PluginLogger.info(`(${c_id}) Badge "${badge.tooltip}" (${badge.id}) successfully registered.`);
            return true;
        } catch (error) {
            PluginLogger.warn(`Could not successfully register badge. (${c_id}) (${value.id})`);
            PluginLogger.error(error);
            return false;
        }
    }

});
