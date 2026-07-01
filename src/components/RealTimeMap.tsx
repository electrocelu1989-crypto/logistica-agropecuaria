import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Usuario, Viaje, Vehiculo } from "../types";
import { Truck, MapPin, Play, Pause, FastForward, Navigation, Layers, Compass, User, RefreshCw } from "lucide-react";

interface RealTimeMapProps {
  usuarios: Usuario[];
  vehiculos: Vehiculo[];
  viajes: Viaje[];
  userRole: "PRODUCTOR" | "CAMIONERO";
  activeUserId: string;
}

// Fixed coordinates for major places for simulation
const CIUDADES_COORDS: { [key: string]: { lat: number; lng: number } } = {
  "Pergamino": { lat: -33.89, lng: -60.57 },
  "Río Cuarto": { lat: -33.12, lng: -64.34 },
  "Junín": { lat: -34.58, lng: -60.94 },
  "Venado Tuerto": { lat: -33.74, lng: -61.97 },
  "Rosario": { lat: -32.95, lng: -60.64 },
  "Puerto General San Martín": { lat: -32.71, lng: -60.72 },
  "Puerto San Lorenzo": { lat: -32.74, lng: -60.73 },
  "Necochea": { lat: -38.58, lng: -58.71 },
  "Bahía Blanca": { lat: -38.78, lng: -62.30 },
  "Cañuelas": { lat: -34.80, lng: -58.76 }
};

export default function RealTimeMap({
  usuarios,
  vehiculos,
  viajes,
  userRole,
  activeUserId
}: RealTimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const routesRef = useRef<{ [key: string]: L.Polyline }>({});

  const [simTimeMultiplier, setSimTimeMultiplier] = useState<number>(2); // Multiplier for speed of simulation
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simProgress, setSimProgress] = useState<number>(0); // 0 to 100 representing cycle progress
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "AVAILABLE" | "IN_TRANSIT">("ALL");

  // Determine active user to center or show location
  const activeUser = usuarios.find(u => u.id === activeUserId);
  const activeUserVehiculo = vehiculos.find(v => v.chofer_id === activeUserId);

  // 1. Static list of mock available trucks (to make the map rich with trucks near producers)
  const mockAvailableTrucks = [
    {
      id: "bot-driver-1",
      nombre: "VÍCTOR PENA",
      telefono: "+5493414445555",
      patente: "AA789XX",
      marca: "Scania R410",
      tipo_carroceria: "TOLVA",
      lat: -33.74, // Venado Tuerto
      lng: -61.97,
      estado: "DISPONIBLE"
    },
    {
      id: "bot-driver-2",
      nombre: "HUGO SÁNCHEZ",
      telefono: "+5491166667777",
      patente: "AE345YY",
      marca: "Mercedes Axor",
      tipo_carroceria: "BATEA",
      lat: -34.58, // Junín
      lng: -60.94,
      estado: "DISPONIBLE"
    },
    {
      id: "bot-driver-3",
      nombre: "DANIEL LÓPEZ",
      telefono: "+5493418889999",
      patente: "AD222ZZ",
      marca: "Volvo FH",
      tipo_carroceria: "BARANDA_VOLCABLE",
      lat: -32.95, // Rosario / San Lorenzo
      lng: -60.64,
      estado: "DISPONIBLE"
    },
    {
      id: "bot-driver-4",
      nombre: "MATEO DIAZ",
      telefono: "+5492915551111",
      patente: "AE555CC",
      marca: "Iveco Stralis",
      tipo_carroceria: "TODO_PUERTAS",
      lat: -38.78, // Bahía Blanca
      lng: -62.30,
      estado: "DISPONIBLE"
    }
  ];

  // 2. Compute active trips with drivers to trace routes and animate
  // Trips in ASIGNADO, EN_CARGA, EN_TRANSITO are currently in-progress
  const activeTrips = viajes.filter(v => 
    v.estado === "ASIGNADO" || 
    v.estado === "EN_CARGA" || 
    v.estado === "EN_TRANSITO"
  );

  // Let's get the active driver info for these trips
  const activeTripDrivers = activeTrips.map(trip => {
    const chofer = usuarios.find(u => u.id === trip.chofer_id);
    const vehiculo = vehiculos.find(v => v.chofer_id === trip.chofer_id);
    return {
      trip,
      chofer,
      vehiculo
    };
  });

  // Calculate coordinates for in-transit trucks based on progress
  const getInterpolatedCoords = (start: { lat: number; lng: number }, end: { lat: number; lng: number }, progress: number) => {
    // progress is 0 to 100
    const ratio = progress / 100;
    return {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio
    };
  };

  // 3. Increment simulation progress
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSimProgress(prev => {
        const next = prev + 0.5 * simTimeMultiplier;
        return next >= 100 ? 0 : next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, simTimeMultiplier]);

  // 4. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Standard center focused on Pergamino (Buenos Aires/Santa Fe border, core agriculture zone)
    const defaultCenter: L.LatLngExpression = [-34.2, -61.0];
    const defaultZoom = 7;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(defaultCenter, defaultZoom);

    mapInstanceRef.current = map;

    // Clean modern Voyager tiles without map clutter
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 5. Update Markers and Polylines dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Helper to add or update a marker
    const updateMarker = (
      id: string,
      lat: number,
      lng: number,
      icon: L.DivIcon,
      tooltipContent: string,
      onClickData: any
    ) => {
      let marker = markersRef.current[id];
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.on("click", () => {
          setSelectedEntity(onClickData);
        });
        markersRef.current[id] = marker;
      }
      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -10],
        className: "bg-slate-900 text-white text-[11px] font-semibold px-2 py-1 rounded border-none shadow-md font-sans"
      });
    };

    // Helper to add/update polylines for routes
    const updateRoute = (id: string, start: [number, number], end: [number, number], color: string) => {
      let polyline = routesRef.current[id];
      if (polyline) {
        polyline.setLatLngs([start, end]);
      } else {
        polyline = L.polyline([start, end], {
          color,
          weight: 3,
          dashArray: "5, 10",
          opacity: 0.8
        }).addTo(map);
        routesRef.current[id] = polyline;
      }
    };

    // Keep track of current round of active keys to clean up obsolete ones
    const activeMarkerKeys = new Set<string>();
    const activeRouteKeys = new Set<string>();

    // A) RENDER ACTIVE PRODUCERS REQUESTING FREIGHT (Viajes DISPONIBLE)
    viajes.forEach(viaje => {
      if (viaje.estado === "DISPONIBLE") {
        const key = `viaje-disponible-${viaje.id}`;
        activeMarkerKeys.add(key);

        const icon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 bg-amber-400 rounded-full opacity-35 animate-ping"></div>
              <div class="relative w-8.5 h-8.5 bg-amber-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
            </div>
          `,
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const prod = usuarios.find(u => u.id === viaje.productor_id);
        const label = `${prod?.razon_social || "Productor"} (${viaje.tipo_grano} ${viaje.toneladas} Tn)`;

        updateMarker(key, viaje.origen.lat, viaje.origen.lng, icon, label, {
          type: "flete_pedido",
          viaje,
          productor: prod
        });
      }
    });

    // B) RENDER AVAILABLE TRUCKS (Active drivers with no trip + Mock bots)
    if (filterType === "ALL" || filterType === "AVAILABLE") {
      // Direct registered available drivers
      const registeredDrivers = usuarios.filter(u => u.rol === "CAMIONERO");
      registeredDrivers.forEach(driver => {
        // Find if they have an active trip
        const hasActiveTrip = viajes.some(v => v.chofer_id === driver.id && v.estado !== "CANCELADO" && v.estado !== "ENTREGADO");
        if (!hasActiveTrip && driver.estado_cuenta === "APROBADO") {
          const key = `driver-available-${driver.id}`;
          activeMarkerKeys.add(key);

          // Position slightly offset from Rosario Pellegerini to simulate active position
          const lat = -32.95;
          const lng = -60.64;

          const veh = vehiculos.find(v => v.chofer_id === driver.id);

          const icon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 bg-emerald-400 rounded-full opacity-45 animate-pulse"></div>
                <div class="relative w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="11" x="2" y="8" rx="2" ry="2"/><path d="M12 18H6M22 18h-4a3 3 0 0 0-3-3h-3a3 3 0 0 0-3 3H2"/><path d="M16 11V5a2 2 0 0 0-2-2H9v6"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/></svg>
                </div>
              </div>
            `,
            className: "",
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          updateMarker(key, lat, lng, icon, `Camionero Disponible: ${driver.razon_social}`, {
            type: "camion_disponible",
            chofer: driver,
            vehiculo: veh
          });
        }
      });

      // Mock bot available drivers
      mockAvailableTrucks.forEach(bot => {
        const key = `bot-available-${bot.id}`;
        activeMarkerKeys.add(key);

        const icon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 bg-emerald-400 rounded-full opacity-40 animate-pulse"></div>
              <div class="relative w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="11" x="2" y="8" rx="2" ry="2"/><path d="M12 18H6M22 18h-4a3 3 0 0 0-3-3h-3a3 3 0 0 0-3 3H2"/><path d="M16 11V5a2 2 0 0 0-2-2H9v6"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/></svg>
              </div>
            </div>
          `,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        updateMarker(key, bot.lat, bot.lng, icon, `Disponible: ${bot.nombre} (${bot.marca})`, {
          type: "camion_bot",
          chofer: bot
        });
      });
    }

    // C) RENDER ACTIVE TRIPS (Trucks in transit)
    if (filterType === "ALL" || filterType === "IN_TRANSIT") {
      activeTripDrivers.forEach(({ trip, chofer, vehiculo }) => {
        if (!trip.origen || !trip.destino) return;

        const markerKey = `trip-truck-${trip.id}`;
        const routeKey = `trip-route-${trip.id}`;
        const startPointMarkerKey = `trip-start-${trip.id}`;
        const endPointMarkerKey = `trip-end-${trip.id}`;

        activeMarkerKeys.add(markerKey);
        activeMarkerKeys.add(startPointMarkerKey);
        activeMarkerKeys.add(endPointMarkerKey);
        activeRouteKeys.add(routeKey);

        // Compute current coordinates based on simulation clock
        const currentCoord = getInterpolatedCoords(
          { lat: trip.origen.lat, lng: trip.origen.lng },
          { lat: trip.destino.lat, lng: trip.destino.lng },
          simProgress
        );

        // Start Node (Origen) - Gray factory/farm pin
        const startIcon = L.divIcon({
          html: `<div class="w-3.5 h-3.5 bg-slate-700 rounded-full border-2 border-white shadow-sm"></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        updateMarker(startPointMarkerKey, trip.origen.lat, trip.origen.lng, startIcon, `Origen: ${trip.origen.direccion}`, {
          type: "viaje_origen",
          trip
        });

        // End Node (Destino) - Blue port flag
        const endIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-5 h-5 bg-blue-100 border border-blue-600 rounded-md flex items-center justify-center text-blue-800 font-extrabold text-[9px] shadow-sm">
                ⚓
              </div>
            </div>
          `,
          className: "",
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        updateMarker(endPointMarkerKey, trip.destino.lat, trip.destino.lng, endIcon, `Destino Portuario: ${trip.destino.direccion}`, {
          type: "viaje_destino",
          trip
        });

        // Draw dotted route path
        updateRoute(routeKey, [trip.origen.lat, trip.origen.lng], [trip.destino.lat, trip.destino.lng], "#3b82f6");

        // Dynamic Moving Truck Icon
        const truckIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 bg-blue-400 rounded-full opacity-45 animate-ping"></div>
              <div class="relative w-8.5 h-8.5 bg-blue-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="11" x="2" y="8" rx="2" ry="2"/><path d="M12 18H6M22 18h-4a3 3 0 0 0-3-3h-3a3 3 0 0 0-3 3H2"/><path d="M16 11V5a2 2 0 0 0-2-2H9v6"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/></svg>
              </div>
            </div>
          `,
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const cargoInfo = `${trip.tipo_grano} (${trip.toneladas} Tn) - ${trip.estado}`;
        const driverName = chofer?.razon_social || "Chofer Asignado";

        updateMarker(markerKey, currentCoord.lat, currentCoord.lng, truckIcon, `Camión en Tránsito: ${driverName} (${cargoInfo})`, {
          type: "viaje_activo",
          trip,
          chofer,
          vehiculo,
          progress: simProgress,
          currentCoord
        });
      });
    }

    // D) CLEAN UP REMOVED MARKERS & ROUTES
    Object.keys(markersRef.current).forEach(key => {
      if (!activeMarkerKeys.has(key)) {
        markersRef.current[key]?.remove();
        delete markersRef.current[key];
      }
    });

    Object.keys(routesRef.current).forEach(key => {
      if (!activeRouteKeys.has(key)) {
        routesRef.current[key]?.remove();
        delete routesRef.current[key];
      }
    });

  }, [viajes, usuarios, simProgress, filterType]);

  const handleCenterActiveUser = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userRole === "PRODUCTOR") {
      // Find one of the active producer's trips or Pergamino defaults
      const activeTrips = viajes.filter(v => v.productor_id === activeUserId);
      if (activeTrips.length > 0 && activeTrips[0]?.origen) {
        map.setView([activeTrips[0]!.origen.lat, activeTrips[0]!.origen.lng], 9);
      } else {
        map.setView([-33.89, -60.57], 9); // Center Pergamino
      }
    } else {
      // Driver Carlos default or Rosario
      map.setView([-32.95, -60.64], 9); // Rosario
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[550px] lg:h-[600px] w-full">
      {/* Map Control Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/15 p-1.5 rounded-lg text-emerald-400">
            <Compass className="h-5 w-5 animate-spin" style={{ animationDuration: "12s" }} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              Ubicación de Camiones en Tiempo Real
              <span className="bg-emerald-500 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                vivo
              </span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {userRole === "PRODUCTOR" 
                ? "Supervise los fletes contratados y busque choferes disponibles cerca de sus estancias."
                : "Busque fletes cargados en sus inmediaciones y trace la ruta hacia los puertos."}
            </p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-0.5 text-xs font-semibold border border-slate-700">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === "ALL" ? "bg-slate-700 text-white font-extrabold" : "text-slate-400 hover:text-white"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType("AVAILABLE")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === "AVAILABLE" ? "bg-[#10b981] text-slate-950 font-black" : "text-slate-400 hover:text-white"
              }`}
            >
              Disponibles
            </button>
            <button
              onClick={() => setFilterType("IN_TRANSIT")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === "IN_TRANSIT" ? "bg-blue-600 text-white font-extrabold" : "text-slate-400 hover:text-white"
              }`}
            >
              En Viaje
            </button>
          </div>

          <div className="h-5 w-[1px] bg-slate-700 hidden sm:inline"></div>

          {/* Map action shortcuts */}
          <button
            onClick={handleCenterActiveUser}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-700 hover:text-white flex items-center gap-1.5 transition font-semibold"
          >
            <Navigation className="h-3.5 w-3.5 text-emerald-400" />
            Mi Ubicación
          </button>
        </div>
      </div>

      {/* Main Map Body */}
      <div className="flex-grow flex flex-col md:flex-row relative overflow-hidden">
        
        {/* Leaflet Map Div */}
        <div className="flex-grow h-full min-h-[300px] relative z-10">
          <div ref={mapContainerRef} className="w-full h-full" id="realtime-leaflet-canvas" />
          
          {/* Floating Time Controls */}
          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-slate-700/50 flex items-center gap-3 shadow-lg">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-white transition focus:outline-none"
              title={isPlaying ? "Pausar simulación" : "Reanudar simulación"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
            </button>

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Velocidad:</span>
              <button
                onClick={() => setSimTimeMultiplier(prev => (prev === 2 ? 4 : prev === 4 ? 8 : prev === 8 ? 1 : 2))}
                className="bg-slate-800 text-slate-200 text-[10px] font-mono px-1.5 py-1 rounded border border-slate-700 hover:bg-slate-700 flex items-center gap-1"
              >
                {simTimeMultiplier}x
                <FastForward className="h-3 w-3" />
              </button>
            </div>
            <div className="h-4 w-[1px] bg-slate-800"></div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono text-emerald-400 font-extrabold uppercase tracking-widest">TRANSMITIENDO</span>
            </div>
          </div>
        </div>

        {/* Sidebar Info Panel */}
        <div className="w-full md:w-80 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto z-20">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Detalles del Monitoreo</h4>
            <p className="text-slate-600 text-xs mt-1">Haga clic en cualquier marcador del mapa para inspeccionar el flete o camión seleccionado.</p>
          </div>

          <div className="p-4 flex-grow">
            {!selectedEntity ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 space-y-3">
                <Layers className="h-10 w-10 text-slate-300 stroke-1" />
                <p className="text-xs font-medium">Ningún elemento seleccionado</p>
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 w-full text-left">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Simbología del Mapa:</p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 font-sans">
                    <li className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[8px] font-extrabold border border-white shadow-xs">📍</span>
                      <strong>Flete Solicitado</strong> (Productor disponible)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[8px] border border-white shadow-xs">🚚</span>
                      <strong>Camionero Disponible</strong> (Listo para tomar fletes)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[8px] border border-white shadow-xs">🚚</span>
                      <strong>Camión en Tránsito</strong> (En viaje activo)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 bg-slate-700 rounded-full flex items-center justify-center text-[8px] border border-white shadow-xs">🏭</span>
                      <strong>Origen del carguío</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 bg-blue-100 border border-blue-600 rounded-md flex items-center justify-center text-[8px]">⚓</span>
                      <strong>Puerto / Destino final</strong>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* 1. PEDIDO DE FLETE */}
                {selectedEntity.type === "flete_pedido" && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        FLETE CARGADO
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 font-bold">#{selectedEntity.viaje.id.substring(0, 8)}</span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm">{selectedEntity.productor?.razon_social}</h4>
                    
                    <div className="border-t border-slate-100 pt-2.5 space-y-2 text-xs">
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Cargamento Requerido</p>
                        <p className="text-slate-800 font-semibold">{selectedEntity.viaje.tipo_grano} • {selectedEntity.viaje.toneladas} Toneladas</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Ubicación de Carga (Origen)</p>
                        <p className="text-slate-700 flex items-start gap-1 mt-0.5 text-[11px] leading-tight">
                          <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          {selectedEntity.viaje.origen.direccion}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Destino Descarga</p>
                        <p className="text-slate-700 flex items-start gap-1 mt-0.5 text-[11px] leading-tight">
                          ⚓ {selectedEntity.viaje.destino.direccion}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Tarifa Ofertada</p>
                        <p className="text-emerald-700 font-extrabold text-xs">
                          ${selectedEntity.viaje.tarifa_por_tonelada.toLocaleString("es-AR")} ARS / Tonelada
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. CAMION EN TRANSITO ACTIVO */}
                {selectedEntity.type === "viaje_activo" && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        EN TRÁNSITO
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 font-bold">Progreso: {Math.round(selectedEntity.progress)}%</span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm">{selectedEntity.chofer?.razon_social || "Carlos Alberto Gómez"}</h4>
                    <p className="text-slate-500 text-xs font-semibold -mt-1">{selectedEntity.vehiculo?.chasis.marca} {selectedEntity.vehiculo?.chasis.modelo} • Patente {selectedEntity.vehiculo?.chasis.patente}</p>

                    <div className="border-t border-slate-100 pt-2.5 space-y-2 text-xs">
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Viaje Asociado</p>
                        <p className="text-slate-800 font-semibold">{selectedEntity.trip.tipo_grano} • {selectedEntity.trip.toneladas} Tn</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Ruta Activa</p>
                        <p className="text-slate-700 text-[11px] flex items-center gap-1 mt-0.5 leading-tight">
                          <span className="font-medium text-slate-500">De:</span> Pergamino
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-medium text-slate-500">A:</span> Puerto SL
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Coordenadas del Satélite</p>
                        <p className="text-slate-500 font-mono text-[10px]">
                          Lat: {selectedEntity.currentCoord?.lat.toFixed(4)}, Lng: {selectedEntity.currentCoord?.lng.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Contacto Directo</p>
                        <p className="text-slate-800 font-mono text-xs">{selectedEntity.chofer?.telefono || "+5493419876543"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. CAMIONERO REGISTRADO DISPONIBLE */}
                {selectedEntity.type === "camion_disponible" && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        SISTEMA ACTIVO
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm">{selectedEntity.chofer?.razon_social}</h4>
                    <p className="text-slate-500 text-xs font-semibold -mt-1">{selectedEntity.vehiculo?.chasis.marca} {selectedEntity.vehiculo?.chasis.modelo}</p>

                    <div className="border-t border-slate-100 pt-2.5 space-y-2 text-xs">
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Patente Chasis</p>
                        <p className="text-slate-800 font-mono font-semibold">{selectedEntity.vehiculo?.chasis.patente || "AA123AA"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Acoplado Habilitado</p>
                        <p className="text-slate-700 font-semibold">{selectedEntity.vehiculo?.acoplado?.tipo_carroceria || "TOLVA"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Número LiNTI</p>
                        <p className="text-slate-800 font-mono font-medium">{selectedEntity.chofer?.perfil_chofer?.numero_linti || "Habilitado ANSV"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Contacto WhatsApp</p>
                        <a 
                          href={`https://wa.me/${selectedEntity.chofer?.telefono.replace("+", "")}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-emerald-600 font-bold hover:underline flex items-center gap-1 mt-0.5"
                        >
                          💬 Enviar WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. CAMION BOT DISPONIBLE */}
                {selectedEntity.type === "camion_bot" && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded uppercase border border-emerald-200">
                        DISPONIBLE CERCA
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm">{selectedEntity.chofer?.nombre}</h4>
                    <p className="text-slate-500 text-xs font-semibold -mt-1">{selectedEntity.chofer?.marca} • Patente {selectedEntity.chofer?.patente}</p>

                    <div className="border-t border-slate-100 pt-2.5 space-y-2 text-xs">
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Carrocería Compatible</p>
                        <p className="text-slate-800 font-semibold">{selectedEntity.chofer?.tipo_carroceria}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Ubicación GPS Actual</p>
                        <p className="text-slate-600">Simulando espera logística en zona agro-industrial cercana.</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase">Acciones</p>
                        <button 
                          onClick={() => alert(`Llamando simulación a ${selectedEntity.chofer?.nombre} al ${selectedEntity.chofer?.telefono}`)}
                          className="w-full mt-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2 rounded-lg text-xs tracking-tight transition"
                        >
                          📞 Contactar Transportista
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedEntity(null)}
                  className="w-full border border-slate-200 hover:border-slate-350 text-slate-500 font-bold text-xs py-2 rounded-lg transition text-center mt-2"
                >
                  Cerrar Detalles
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Simple Helper component for layouts
function ArrowRight({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}
