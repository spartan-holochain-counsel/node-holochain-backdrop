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
    holochainVersion = { # v0.0.101
      rev = "ea726cc05aa6064c3b8b4f85fddf3e89429f018e"; # Jul 1, 2021
      sha256 = "061i7b59pgwf5n4ma6cypg08v50n60z1b2yan3cgwdzmm95na2cm";
      cargoSha256 = "0fs0va4w3vabbdba6pdwfkfyh271ngri0kpv7amgkljfmszxdw1c";

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
