// Minimal Google Maps JavaScript API type definitions for OMCM
/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace google {
  export namespace maps {
    export class Map {
      constructor(mapDiv: HTMLElement, opts?: MapOptions);
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      getZoom(): number | undefined;
      fitBounds(
        bounds: LatLngBounds | LatLngBoundsLiteral,
        padding?: number | Padding,
      ): void;
      panTo(latLng: LatLng | LatLngLiteral): void;
      getBounds(): LatLngBounds | undefined;
      data: Data;
      addListener(
        eventName: string,
        handler: (...args: any[]) => void,
      ): MapsEventListener;
    }

    export interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      minZoom?: number;
      maxZoom?: number;
      restriction?: MapRestriction;
      mapTypeId?: string;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
      mapTypeControl?: boolean;
      scaleControl?: boolean;
      streetViewControl?: boolean;
      rotateControl?: boolean;
      fullscreenControl?: boolean;
      styles?: MapTypeStyle[];
      backgroundColor?: string;
    }

    export interface MapRestriction {
      latLngBounds: LatLngBounds | LatLngBoundsLiteral;
      strictBounds?: boolean;
    }

    export interface MapTypeStyle {
      elementType?: string;
      featureType?: string;
      stylers: object[];
    }

    export interface Padding {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }

    export class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    export interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    export class LatLngBounds {
      constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
      getCenter(): LatLng;
      contains(latLng: LatLng | LatLngLiteral): boolean;
      isEmpty(): boolean;
    }

    export interface LatLngBoundsLiteral {
      east: number;
      north: number;
      south: number;
      west: number;
    }

    export class Polygon {
      constructor(opts?: PolygonOptions);
      setMap(map: Map | null): void;
      setOptions(opts: PolygonOptions): void;
      setPaths(paths: any[]): void;
      addListener(
        eventName: string,
        handler: (...args: any[]) => void,
      ): MapsEventListener;
    }

    export interface PolygonOptions {
      paths?: any[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      clickable?: boolean;
      zIndex?: number;
      map?: Map;
    }

    export class Circle {
      constructor(opts?: PolygonOptions & { center: LatLngLiteral; radius: number });
      setMap(map: Map | null): void;
    }

    export class Polyline {
      constructor(opts?: PolylineOptions);
      setMap(map: Map | null): void;
      setPath(path: any[]): void;
      setOptions(opts: PolylineOptions): void;
    }

    export interface PolylineOptions {
      path?: any[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      geodesic?: boolean;
      icons?: any[];
      zIndex?: number;
      map?: Map;
    }

    export class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latLng: LatLng | LatLngLiteral): void;
      setTitle(title: string): void;
      setIcon(icon: string | Icon | Symbol): void;
      addListener(
        eventName: string,
        handler: (...args: any[]) => void,
      ): MapsEventListener;
    }

    export interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
      icon?: string | Icon | Symbol;
      label?: string | MarkerLabel;
      zIndex?: number;
      animation?: any;
    }

    export interface Icon {
      url: string;
      size?: Size;
      scaledSize?: Size;
      origin?: Point;
      anchor?: Point;
    }

    export interface Symbol {
      path: any;
      fillColor?: string;
      fillOpacity?: number;
      scale?: number;
      strokeColor?: string;
      strokeWeight?: number;
      anchor?: Point;
    }

    export interface MarkerLabel {
      text: string;
      color?: string;
      fontFamily?: string;
      fontSize?: string;
      fontWeight?: string;
    }

    export class Size {
      constructor(width: number, height: number);
      width: number;
      height: number;
    }

    export class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }

    export class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(opts?: any): void;
      close(): void;
      setContent(content: string | Node): void;
      setPosition(position: LatLng | LatLngLiteral): void;
    }

    export interface InfoWindowOptions {
      content?: string | Node;
      position?: LatLng | LatLngLiteral;
      pixelOffset?: Size;
    }

    export enum SymbolPath {
      BACKWARD_CLOSED_ARROW = 3,
      BACKWARD_OPEN_ARROW = 4,
      CIRCLE = 0,
      FORWARD_CLOSED_ARROW = 1,
      FORWARD_OPEN_ARROW = 2,
    }

    export class Data {
      addGeoJson(geoJson: object, options?: any): Data.Feature[];
      loadGeoJson(
        url: string,
        options?: any,
        callback?: (features: Data.Feature[]) => void,
      ): void;
      setStyle(
        style: DataStyleOptions | ((feature: Data.Feature) => DataStyleOptions),
      ): void;
      overrideStyle(feature: Data.Feature, style: DataStyleOptions): void;
      revertStyle(feature?: Data.Feature): void;
      addListener(
        eventName: string,
        handler: (event: any) => void,
      ): MapsEventListener;
      forEach(callback: (feature: Data.Feature) => void): void;
      remove(feature: Data.Feature): void;
    }

    export namespace Data {
      export interface Feature {
        getId(): string | number | undefined;
        getProperty(name: string): any;
        setProperty(name: string, newValue: any): void;
        getGeometry(): any;
      }
    }

    export interface DataStyleOptions {
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
      strokeOpacity?: number;
      visible?: boolean;
      zIndex?: number;
      cursor?: string;
    }

    export interface MapsEventListener {
      remove(): void;
    }

    export namespace event {
      export function removeListener(listener: MapsEventListener): void;
      export function clearInstanceListeners(instance: any): void;
      export function trigger(
        instance: any,
        eventName: string,
        ...args: any[]
      ): void;
    }
  }
}

interface Window {
  google?: typeof google;
}
