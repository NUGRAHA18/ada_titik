import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'injection_container.dart' as di;
import 'injection_container.dart'; 
import 'core/routes/app_router.dart'; 

import 'features/auth/presentation/bloc/auth_bloc.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await di.init();
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Ambil instance AuthBloc sekali saja untuk digunakan di Provider dan Router
    final authBloc = sl<AuthBloc>();

    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>.value(
          value: authBloc,
        ),
      ],
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        title: 'AdaTitik',
        theme: ThemeData(
          fontFamily: 'Inter',
          useMaterial3: true,
          colorSchemeSeed: const Color(0xFF0042B9),
        ),
        // Gunakan instance authBloc yang sama agar sinkron dengan redirect logic
        routerConfig: AppRouter(authBloc).router, 
      ),
    );
  }
}