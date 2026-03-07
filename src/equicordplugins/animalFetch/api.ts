/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CatImage, DogResponse, FoxResponse } from "./types";

const CAT_API_URL = "https://api.thecatapi.com/v1/images/search";
const DOG_API_URL = "https://api.thedogapi.com/v1/images/search";
const FOX_API_URL = "https://randomfox.ca/floof/";

export async function fetchCatImage(): Promise<CatImage> {
    const response = await fetch(CAT_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch cat image: ${response.statusText}`);
    }
    const data = await response.json();
    return data[0];
}

export async function fetchDogImage(): Promise<DogResponse> {
    const response = await fetch(DOG_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch dog image: ${response.statusText}`);
    }
    return await response.json();
}

export async function fetchFoxImage(): Promise<FoxResponse> {
    const response = await fetch(FOX_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch fox image: ${response.statusText}`);
    }
    return await response.json();
}
