let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/6ae8ffb8e5c1a1faa4f4e1af8a9f7139b2ce0f3c.tar.gz";
    sha256 = "0ksvy2m7gpxf5r7l1rznvjwajypk7iii3h5d8nx762kah55nyliq";
  };
  holonix = import (holonixPath) {
    include = {
      holochainBinaries = true;
      node = false;
      happs = false;
    };

    holochainVersionId = "custom";
    holochainVersion = { # v0.0.100
      rev = "3bd9181ea35c32993d1550591fd19720b31065f6"; # Apr 20, 2021
      sha256 = "1sbdcxddpa33gqmly4x5gz2l4vhmab8hwjngpibmqfr1ga6v56wv";
      cargoSha256 = "113swzsyz09vamrh1zi4pwxpj39hyn8g2wr81021ynr9b1ynac28";

      lairKeystoreHashes = { # v0.0.1-alpha.12
        sha256 = "05p8j1yfvwqg2amnbqaphc6cd92k65dq10v3afdj0k0kj42gd6ic";
        cargoSha256 = "0bd1sjx4lngi543l0bnchmpz4qb3ysf8gisary1bhxzq47b286cf";
      };

      bins = {
        holochain = "holochain";
        hc = "hc";
      };
    };
  };
  nixpkgs = holonix.pkgs;
in nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
}
