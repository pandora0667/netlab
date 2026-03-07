import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import {
  DNSQueryResult,
  GEO_URL,
  getRegionColor,
  SERVER_COORDINATES,
} from "./shared";

interface DNSPropagationMapProps {
  results: DNSQueryResult[];
}

export default function DNSPropagationMap({
  results,
}: DNSPropagationMapProps) {
  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-lg bg-white shadow-sm">
      <div className="w-full aspect-[16/9] min-h-[400px] max-h-[600px]">
        <ComposableMap
          projectionConfig={{
            scale: 140,
            center: [0, 20],
            rotate: [-10, 0, 0],
          }}
          className="h-full w-full"
          style={{
            maxWidth: "100%",
            height: "auto",
          }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryCode = geo.properties.iso_a2;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getRegionColor(countryCode)}
                      stroke="#FFFFFF"
                      strokeWidth={0.5}
                      style={{
                        default: {
                          outline: "none",
                        },
                        hover: {
                          fill: "#F5F5F5",
                          outline: "none",
                          transition: "all 250ms",
                        },
                        pressed: {
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {results.map((result, index) => {
              const coordinates = SERVER_COORDINATES[result.server.country_code];
              if (!coordinates) {
                return null;
              }

              return (
                <Marker key={`${result.server.ip_address}-${index}`} coordinates={coordinates}>
                  <g transform="translate(-12, -24)" style={{ cursor: "pointer" }}>
                    <circle
                      r={6}
                      fill={result.status === "success" ? "#4CAF50" : "#f44336"}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    <circle
                      r={15}
                      fill={result.status === "success" ? "#4CAF50" : "#f44336"}
                      fillOpacity={0.2}
                      stroke="none"
                    >
                      <animate
                        attributeName="r"
                        from="8"
                        to="20"
                        dur="1.5s"
                        begin="0s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.6"
                        to="0"
                        dur="1.5s"
                        begin="0s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <title>
                      {result.server.name} ({result.server.country_code})
                      {"\n"}Status: {result.status}
                      {"\n"}Latency: {result.latency}ms
                    </title>
                  </g>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
        <div className="absolute bottom-2 right-2 z-10 rounded-lg bg-white/80 p-2 text-sm shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Success
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Failed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
