{ pkgs ? import ./nixpkgs.nix {} }:

with pkgs;

let
  inherit (rust.packages.stable) rustPlatform;
in

{
  hc-backdrop = stdenv.mkDerivation rec {
    name = "hc-backdrop";
    src = gitignoreSource ./.;

    buildInputs = [
      holochain
      hc
      lair-keystore
      cargo
      jq
    ];

    nativeBuildInputs = [
    ];
  };
}
