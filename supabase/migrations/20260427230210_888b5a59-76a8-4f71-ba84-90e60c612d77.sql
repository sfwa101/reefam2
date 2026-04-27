-- Allow admins to insert notifications for any user (broadcast/targeted send)
CREATE POLICY "Admin can insert notifications for anyone"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can view all notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));