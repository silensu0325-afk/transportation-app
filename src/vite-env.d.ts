/// <reference types="vite/client" />

// Google Maps types
declare namespace google.maps {
  class DistanceMatrixService {
    getDistanceMatrix(
      request: DistanceMatrixRequest,
      callback: (response: DistanceMatrixResponse | null, status: string) => void
    ): void;
  }

  interface DistanceMatrixRequest {
    origins: string[];
    destinations: string[];
    travelMode: TravelMode;
    unitSystem?: UnitSystem;
  }

  interface DistanceMatrixResponse {
    rows: Array<{
      elements: Array<{
        status: string;
        distance?: { text: string; value: number };
        duration?: { text: string; value: number };
      }>;
    }>;
  }

  enum TravelMode {
    DRIVING = 'DRIVING',
  }

  enum UnitSystem {
    METRIC = 0,
  }

  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, options?: AutocompleteOptions);
      addListener(event: string, handler: () => void): void;
      getPlace(): PlaceResult;
    }

    interface AutocompleteOptions {
      componentRestrictions?: { country: string };
      fields?: string[];
    }

    interface PlaceResult {
      formatted_address?: string;
      name?: string;
      geometry?: {
        location: {
          lat(): number;
          lng(): number;
        };
      };
    }
  }
}
