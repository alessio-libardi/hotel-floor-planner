import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FloorViewModel, RoomViewModel } from './floor.models';

const API_BASE_URL = '/api';

export type PlanItemType = 'table' | 'column' | 'label';

export interface PlanItemDto {
  id: string;
  type: PlanItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tableNumber: number | null;
  roomNumber: number | null;
}

@Injectable({ providedIn: 'root' })
export class FloorPlannerApi {
  private readonly http = inject(HttpClient);

  getFloors() {
    const params = new HttpParams().set('_ts', Date.now().toString());
    return this.http.get<FloorViewModel[]>(`${API_BASE_URL}/floors`, { params });
  }

  createFloor() {
    return this.http.post<FloorViewModel>(`${API_BASE_URL}/floors`, {});
  }

  deleteFloor(floorId: string) {
    return this.http.delete<{ deleted: true }>(`${API_BASE_URL}/floors/${floorId}`);
  }

  createRoom(floorId: string) {
    return this.http.post<RoomViewModel>(`${API_BASE_URL}/floors/${floorId}/rooms`, {});
  }

  updateRoom(floorId: string, roomId: string, label: string) {
    return this.http.patch<RoomViewModel>(`${API_BASE_URL}/floors/${floorId}/rooms/${roomId}`, { label });
  }

  deleteRoom(floorId: string, roomId: string) {
    return this.http.delete<{ deleted: true }>(`${API_BASE_URL}/floors/${floorId}/rooms/${roomId}`);
  }

  getPlanItems() {
    const params = new HttpParams().set('_ts', Date.now().toString());
    return this.http.get<PlanItemDto[]>(`${API_BASE_URL}/plan-items`, { params });
  }

  createPlanItem(type: PlanItemType) {
    return this.http.post<PlanItemDto>(`${API_BASE_URL}/plan-items`, { type });
  }

  updatePlanItem(
    itemId: string,
    patch: Partial<Pick<PlanItemDto, 'x' | 'y' | 'width' | 'height' | 'text' | 'tableNumber' | 'roomNumber'>>
  ) {
    return this.http.patch<PlanItemDto>(`${API_BASE_URL}/plan-items/${itemId}`, patch);
  }

  deletePlanItem(itemId: string) {
    return this.http.delete<{ deleted: true }>(`${API_BASE_URL}/plan-items/${itemId}`);
  }
}