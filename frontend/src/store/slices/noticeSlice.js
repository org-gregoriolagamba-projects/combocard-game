/**
 * Notice Slice
 *
 * The announcement for all the players and the maintenance mode, as the server says them: read from
 * the public status at startup and every time the socket connects, and changed by the events `avviso`
 * and `manutenzione`. A failure to read never throws away what was already read.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as statusService from "../../services/statusService";

export const fetchStatus = createAsyncThunk(
  "notices/fetchStatus",
  async (_, { rejectWithValue }) => {
    try {
      const answer = await statusService.getStatus();
      if (!answer || typeof answer !== "object") {
        return rejectWithValue("Stato non valido");
      }
      return answer;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  // { version, message, severity, startsAt, endsAt } or null
  announcement: null,
  // { active: true, message, endsAt } or null when the maintenance is off
  maintenance: null,
  // idle | loading | ready | error
  status: "idle",
};

const noticeSlice = createSlice({
  name: "notices",
  initialState,
  reducers: {
    setAnnouncement: (state, action) => {
      state.announcement = action.payload ?? null;
    },
    setMaintenance: (state, action) => {
      state.maintenance = action.payload ?? null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStatus.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchStatus.fulfilled, (state, action) => {
        state.announcement = action.payload.announcement ?? null;
        state.maintenance = action.payload.maintenance ?? null;
        state.status = "ready";
      })
      .addCase(fetchStatus.rejected, (state) => {
        state.status = "error";
      });
  },
});

export const { setAnnouncement, setMaintenance } = noticeSlice.actions;
export default noticeSlice.reducer;
