#! /bin/sh
rm /etc/X11/xorg.conf.d/90-mhwd.conf
mv ./prime/optimus.conf /etc/X11/xorg.conf.d/
rm /etc/modprobe.d/mhwd*
mv ./prime/nvidia.conf /etc/modprobe.d/nvidia.conf
echo "options nvidia_drm modeset=1" > /etc/modprobe.d/nvidia-drm.conf
mv ./prime/optimus.sh /usr/local/bin/optimus.sh
chmod ar+x /usr/local/bin/optimus.sh
mv ./prime/lightdm.conf  /etc/lightdm/lightdm.conf
