package com.leonardobarreiras.seatingmanagement

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint

import com.leonardobarreiras.seatingmanagement.ui.screens.*
import com.leonardobarreiras.seatingmanagement.ui.theme.*
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = CorporateBlue, secondary = SuccessGreen, background = LightBg)) {
                val navController = rememberNavController()
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {

                    val sharedViewModel: SeatViewModel = hiltViewModel()
                    val startDestination = remember { sharedViewModel.getStartDestination() }

                    LaunchedEffect(sharedViewModel.forceLogoutEvent) {
                        if (sharedViewModel.forceLogoutEvent) {
                            sharedViewModel.logout()
                            navController.navigate("login") { popUpTo(0) { inclusive = true } }
                            sharedViewModel.forceLogoutEvent = false
                        }
                    }

                    NavHost(navController = navController, startDestination = startDestination) {
                        composable("login") {
                            LoginScreen(
                                onLoginSuccess = {
                                    if (sharedViewModel.secureStorage.hasPin()) {
                                        navController.navigate("event_selection") { popUpTo("login") { inclusive = true } }
                                    } else {
                                        navController.navigate("pin_setup") { popUpTo("login") { inclusive = true } }
                                    }
                                },
                                viewModel = sharedViewModel
                            )
                        }

                        composable("pin_setup") {
                            PinSetupScreen(
                                viewModel = sharedViewModel,
                                onComplete = { navController.navigate("event_selection") { popUpTo("pin_setup") { inclusive = true } } }
                            )
                        }

                        composable("pin_auth") {
                            PinAuthScreen(
                                viewModel = sharedViewModel,
                                onSuccess = { navController.navigate("event_selection") { popUpTo("pin_auth") { inclusive = true } } },
                                onLogout = {
                                    sharedViewModel.logout()
                                    navController.navigate("login") { popUpTo(0) { inclusive = true } }
                                }
                            )
                        }

                        composable("event_selection") { EventSelectionScreen(viewModel = sharedViewModel, onEventSelected = { navController.navigate("dashboard") { popUpTo("event_selection") { inclusive = true } } }) }
                        composable("dashboard") { SeatScreen(viewModel = sharedViewModel, navController = navController) }
                    }
                }
            }
        }
    }
}