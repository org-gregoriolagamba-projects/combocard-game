/**
 * Settings Slice
 *
 * The game settings of the server (players, entry fee, jolly, wait between draws), read when the
 * player is known and every time the hall or the new game form opens. Only the last request counts:
 * an old answer that arrives late is ignored. A failure never replaces values that were already read,
 * and when there are none there is no number to show: the screens say so and offer to try again.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as settingsService from "../../services/settingsService";
import { clearPlayer, logout } from "./playerSlice";

export const fetchSettings = createAsyncThunk(
  "settings/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await settingsService.getSettings();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  values: null,
  limits: null,
  // idle | loading | ready | error
  status: "idle",
  error: null,
  // The last request made: the answers of the older ones are not used
  requestId: null,
};

const isLast = (state, action) => state.requestId === action.meta.requestId;

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    clearSettings: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        // With values already read the screens keep using them while the new ones arrive
        if (!state.values) {
          state.status = "loading";
          state.error = null;
        }
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        if (!isLast(state, action)) {
          return;
        }
        state.values = action.payload.values;
        state.limits = action.payload.limits;
        state.status = "ready";
        state.error = null;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        if (!isLast(state, action) || state.values) {
          return;
        }
        state.status = "error";
        state.error = action.payload ?? action.error?.message ?? null;
      })
      .addCase(clearPlayer, () => initialState)
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const { clearSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
