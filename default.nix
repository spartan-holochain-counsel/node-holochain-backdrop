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
    holochainVersion = { # v0.0.104
      rev = "d003eb7a45f1d7125c4701332202761721793d68"; # Aug 25, 2021
      sha256 = "0qxadszm2a7807w49kfbj7cx6lr31qryxcyd2inyv7q5j7qbanf2";
      cargoSha256 = "129wicin99kmxb2qwhll8f4q78gviyp73hrkm6klpkql6810y3jy";

      lairKeystoreHashes = { # v0.0.4
        sha256 = "0khg5w5fgdp1sg22vqyzsb2ri7znbxiwl7vr2zx6bwn744wy2cyv";
        cargoSha256 = "1lm8vrxh7fw7gcir9lq85frfd0rdcca9p7883nikjfbn21ac4sn4";
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
